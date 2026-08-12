package service

import (
	"errors"
	"testing"
)

func preserveXrayRestartTestState(t *testing.T) {
	t.Helper()

	originalPending := isNeedXrayRestart.Load()
	originalGeneration := xrayRestartGeneration.Load()

	t.Cleanup(func() {
		isNeedXrayRestart.Store(originalPending)
		xrayRestartGeneration.Store(originalGeneration)
	})
}

func TestFinishXrayRestartClearsCoveredRequest(t *testing.T) {
	preserveXrayRestartTestState(t)

	xrayRestartGeneration.Store(100)
	isNeedXrayRestart.Store(true)

	if err := finishXrayRestart(100, true, nil); err != nil {
		t.Fatalf("finishXrayRestart: %v", err)
	}

	if isNeedXrayRestart.Load() {
		t.Fatal("covered request must be cleared after success")
	}
}

func TestFinishXrayRestartPreservesNewerRequest(t *testing.T) {
	preserveXrayRestartTestState(t)

	xrayRestartGeneration.Store(200)
	isNeedXrayRestart.Store(true)

	startGeneration := xrayRestartGeneration.Load()

	// Simulate a committed configuration change arriving while restart/hot
	// apply is already in progress.
	markXrayRestartNeeded()

	if err := finishXrayRestart(
		startGeneration,
		true,
		nil,
	); err != nil {
		t.Fatalf("finishXrayRestart: %v", err)
	}

	if !isNeedXrayRestart.Load() {
		t.Fatal("newer request must survive completion of an older restart")
	}

	if got := xrayRestartGeneration.Load(); got != 201 {
		t.Fatalf("generation = %d, want 201", got)
	}
}

func TestFinishXrayReconcileDoesNotConsumeUnrelatedPendingRequest(t *testing.T) {
	preserveXrayRestartTestState(t)

	xrayRestartGeneration.Store(300)
	isNeedXrayRestart.Store(true)

	if err := finishXrayRestart(300, false, nil); err != nil {
		t.Fatalf("finishXrayRestart: %v", err)
	}

	if !isNeedXrayRestart.Load() {
		t.Fatal("snapshot-only reconcile must not clear an unrelated request")
	}
}

func TestFinishXrayRestartFailureSchedulesNewRetry(t *testing.T) {
	preserveXrayRestartTestState(t)

	xrayRestartGeneration.Store(400)
	isNeedXrayRestart.Store(false)

	want := errors.New("injected restart failure")

	got := finishXrayRestart(400, true, want)
	if !errors.Is(got, want) {
		t.Fatalf("error = %v, want %v", got, want)
	}

	if !isNeedXrayRestart.Load() {
		t.Fatal("failed restart must schedule a retry")
	}

	if gotGeneration := xrayRestartGeneration.Load(); gotGeneration != 401 {
		t.Fatalf(
			"generation after failure = %d, want 401",
			gotGeneration,
		)
	}
}

func TestSetToNeedRestartAdvancesGeneration(t *testing.T) {
	preserveXrayRestartTestState(t)

	xrayRestartGeneration.Store(500)
	isNeedXrayRestart.Store(false)

	(&XrayService{}).SetToNeedRestart()

	if !isNeedXrayRestart.Load() {
		t.Fatal("SetToNeedRestart must set the pending flag")
	}

	if got := xrayRestartGeneration.Load(); got != 501 {
		t.Fatalf("generation = %d, want 501", got)
	}
}
