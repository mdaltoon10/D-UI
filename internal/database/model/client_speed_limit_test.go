package model

import "testing"

func TestClientSpeedLimitsRoundTrip(t *testing.T) {
	original := &Client{
		Email:        "speed-test@example.com",
		UploadMbps:   12,
		DownloadMbps: 34,
		Enable:       true,
	}

	record := original.ToRecord()

	if record.UploadMbps != original.UploadMbps {
		t.Fatalf(
			"ToRecord uploadMbps = %d, want %d",
			record.UploadMbps,
			original.UploadMbps,
		)
	}

	if record.DownloadMbps != original.DownloadMbps {
		t.Fatalf(
			"ToRecord downloadMbps = %d, want %d",
			record.DownloadMbps,
			original.DownloadMbps,
		)
	}

	restored := record.ToClient()

	if restored.UploadMbps != original.UploadMbps {
		t.Fatalf(
			"ToClient uploadMbps = %d, want %d",
			restored.UploadMbps,
			original.UploadMbps,
		)
	}

	if restored.DownloadMbps != original.DownloadMbps {
		t.Fatalf(
			"ToClient downloadMbps = %d, want %d",
			restored.DownloadMbps,
			original.DownloadMbps,
		)
	}
}

func TestMergeClientRecordSpeedLimits(t *testing.T) {
	existing := &ClientRecord{
		Email:        "merge-test@example.com",
		UploadMbps:   10,
		DownloadMbps: 20,
	}

	incoming := &ClientRecord{
		Email:        existing.Email,
		UploadMbps:   15,
		DownloadMbps: 5,
	}

	MergeClientRecord(existing, incoming)

	if existing.UploadMbps != 10 {
		t.Fatalf("merged uploadMbps = %d, want 10", existing.UploadMbps)
	}

	if existing.DownloadMbps != 5 {
		t.Fatalf("merged downloadMbps = %d, want 5", existing.DownloadMbps)
	}
}
