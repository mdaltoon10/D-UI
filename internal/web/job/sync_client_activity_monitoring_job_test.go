package job

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestNormalizeClientActivityMonitoringRows(t *testing.T) {
	rows := []clientActivityMonitoringRow{
		{
			ClientID:   2,
			Email:      " beta ",
			Generation: 3,
			DataEpoch:  2,
		},
		{
			ClientID:   1,
			Email:      "alpha",
			Generation: 4,
			DataEpoch:  3,
		},
		{
			ClientID:   99,
			Email:      "",
			Generation: 1,
			DataEpoch:  1,
		},
		{
			ClientID:   5,
			Email:      "beta",
			Generation: 2,
			DataEpoch:  9,
		},
		{
			ClientID:   3,
			Email:      "gamma",
			Generation: -5,
			DataEpoch:  0,
		},
	}

	got := normalizeClientActivityMonitoringRows(rows)

	if len(got) != 3 {
		t.Fatalf("expected 3 rows, got %d: %+v", len(got), got)
	}

	if got[0].Email != "alpha" {
		t.Fatalf("rows are not sorted: %+v", got)
	}

	if got[1].Email != "beta" ||
		got[1].ClientID != 2 ||
		got[1].Generation != 3 ||
		got[1].DataEpoch != 2 {
		t.Fatalf("unexpected duplicate resolution: %+v", got[1])
	}

	if got[2].Email != "gamma" ||
		got[2].Generation != 0 ||
		got[2].DataEpoch != 1 {
		t.Fatalf("unexpected normalization: %+v", got[2])
	}
}

func TestBuildClientActivityMonitoringJSON(t *testing.T) {
	rows := []clientActivityMonitoringRow{
		{
			ClientID:   20,
			Email:      "second",
			Generation: 7,
			DataEpoch:  4,
		},
		{
			ClientID:   10,
			Email:      "first",
			Generation: 2,
			DataEpoch:  1,
		},
	}

	data, err := buildClientActivityMonitoringJSON(rows)
	if err != nil {
		t.Fatalf("build JSON: %v", err)
	}

	if len(data) == 0 || data[len(data)-1] != '\n' {
		t.Fatal("JSON must end with a newline")
	}

	var decoded clientActivityMonitoringFile
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("decode JSON: %v", err)
	}

	if decoded.Version != 1 {
		t.Fatalf("unexpected version: %d", decoded.Version)
	}

	if len(decoded.Clients) != 2 {
		t.Fatalf(
			"expected 2 clients, got %d",
			len(decoded.Clients),
		)
	}

	first := decoded.Clients["first"]
	if first.ClientID != 10 ||
		first.Generation != 2 ||
		first.DataEpoch != 1 {
		t.Fatalf("unexpected first client: %+v", first)
	}

	reversed := []clientActivityMonitoringRow{
		rows[1],
		rows[0],
	}

	secondData, err := buildClientActivityMonitoringJSON(reversed)
	if err != nil {
		t.Fatalf("build reversed JSON: %v", err)
	}

	if !bytes.Equal(data, secondData) {
		t.Fatalf(
			"JSON output is not deterministic:\n%s\n%s",
			data,
			secondData,
		)
	}
}

func TestBuildEmptyClientActivityMonitoringJSON(t *testing.T) {
	data, err := buildClientActivityMonitoringJSON(nil)
	if err != nil {
		t.Fatalf("build empty JSON: %v", err)
	}

	var decoded clientActivityMonitoringFile
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("decode empty JSON: %v", err)
	}

	if decoded.Version != 1 {
		t.Fatalf("unexpected version: %d", decoded.Version)
	}

	if decoded.Clients == nil {
		t.Fatal("clients must be encoded as an empty object, not null")
	}

	if len(decoded.Clients) != 0 {
		t.Fatalf(
			"expected empty clients map, got %d",
			len(decoded.Clients),
		)
	}
}
