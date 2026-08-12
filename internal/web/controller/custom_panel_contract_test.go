package controller

import (
	"bytes"
	"errors"
	"math"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func customPanelDecodeContext(body string) *gin.Context {
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest("POST", "/api", bytes.NewBufferString(body))
	context.Request.Header.Set("Content-Type", "application/json")
	return context
}

func TestDecodeCustomPanelRequestIsStrict(t *testing.T) {
	valid, err := decodeCustomPanelRequest(customPanelDecodeContext(`{"action":" GET_USER ","username":"alice"}`))
	if err != nil {
		t.Fatalf("valid request: %v", err)
	}
	if valid.Action != "get_user" || valid.Username != "alice" {
		t.Fatalf("decoded request = %#v", valid)
	}

	for _, body := range []string{
		`{}`,
		`{"action":"get_user","unknown":true}`,
		`{"action":"get_user"}{"action":"get_user"}`,
		`[]`,
	} {
		if _, err := decodeCustomPanelRequest(customPanelDecodeContext(body)); err == nil {
			t.Fatalf("request %s must fail", body)
		}
	}
}

func TestDecodeCustomPanelModifyConfig(t *testing.T) {
	config, err := decodeCustomPanelModifyConfig([]byte(`{"status":"active","data_limit":12,"expire":34,"note":"n"}`))
	if err != nil {
		t.Fatalf("valid config: %v", err)
	}
	if config.Status == nil || *config.Status != "active" || config.DataLimit == nil || *config.DataLimit != 12 || config.Expire == nil || *config.Expire != 34 || config.Note == nil || *config.Note != "n" {
		t.Fatalf("decoded config = %#v", config)
	}

	for _, raw := range []string{
		`null`,
		`{}`,
		`{"unknown":true}`,
		`{"status":"active"}{}`,
	} {
		if _, err := decodeCustomPanelModifyConfig([]byte(raw)); err == nil {
			t.Fatalf("config %s must fail", raw)
		}
	}
}

func TestCustomPanelConversionsAndStatus(t *testing.T) {
	if got, err := customPanelExpiryMilliseconds(1_735_689_600); err != nil || got != 1_735_689_600_000 {
		t.Fatalf("expiry milliseconds = %d, %v", got, err)
	}
	if _, err := customPanelExpiryMilliseconds(-1); err == nil {
		t.Fatal("negative expiry must fail")
	}
	if _, err := customPanelExpiryMilliseconds(math.MaxInt64/1000 + 1); err == nil {
		t.Fatal("overflowing expiry must fail")
	}
	if got, err := customPanelExpirySeconds(1_735_689_600_999); err != nil || got != 1_735_689_600 {
		t.Fatalf("expiry seconds = %d, %v", got, err)
	}
	if _, err := customPanelExpirySeconds(-1); err == nil {
		t.Fatal("delayed-start expiry must fail")
	}

	active, err := customPanelStatus(" ACTIVE ")
	if err != nil || !active {
		t.Fatalf("active = %v, %v", active, err)
	}
	disabled, err := customPanelStatus("disabled")
	if err != nil || disabled {
		t.Fatalf("disabled = %v, %v", disabled, err)
	}
	if _, err := customPanelStatus("paused"); err == nil {
		t.Fatal("unknown status must fail")
	}
}

func TestCustomPanelPublicErrorMapping(t *testing.T) {
	if got := customPanelPublicMessage(newCustomPanelPublicError("Invalid request")); got != "Invalid request" {
		t.Fatalf("public error = %q", got)
	}
	if got := customPanelPublicMessage(gorm.ErrRecordNotFound); got != "User not found" {
		t.Fatalf("not-found error = %q", got)
	}
	if got := customPanelPublicMessage(errors.New("email already in use: alice")); got != "Username already exists" {
		t.Fatalf("duplicate error = %q", got)
	}
	if got := customPanelPublicMessage(assertRecordNotFound{}); got != "Operation failed" {
		t.Fatalf("unrelated error = %q", got)
	}
}

type assertRecordNotFound struct{}

func (assertRecordNotFound) Error() string {
	return "not found text alone is not a database sentinel"
}
