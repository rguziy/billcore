package domain

import (
	"encoding/json"
	"testing"
	"time"
)

func TestSubscriptionUnmarshalJSONAcceptsDateOnly(t *testing.T) {
	var sub Subscription
	err := json.Unmarshal([]byte(`{
		"location_id": 1,
		"service_id": 2,
		"connected_at": "2014-02-01"
	}`), &sub)
	if err != nil {
		t.Fatalf("unmarshal subscription: %v", err)
	}

	want := time.Date(2014, 2, 1, 0, 0, 0, 0, time.UTC)
	if !sub.ConnectedAt.Equal(want) {
		t.Fatalf("connected_at = %v, want %v", sub.ConnectedAt, want)
	}
}

func TestSubscriptionUnmarshalJSONAcceptsRFC3339(t *testing.T) {
	var sub Subscription
	err := json.Unmarshal([]byte(`{
		"location_id": 1,
		"service_id": 2,
		"connected_at": "2014-02-01T12:30:00Z"
	}`), &sub)
	if err != nil {
		t.Fatalf("unmarshal subscription: %v", err)
	}

	want := time.Date(2014, 2, 1, 12, 30, 0, 0, time.UTC)
	if !sub.ConnectedAt.Equal(want) {
		t.Fatalf("connected_at = %v, want %v", sub.ConnectedAt, want)
	}
}

func TestSubscriptionUnmarshalJSONAllowsMissingConnectedAt(t *testing.T) {
	var sub Subscription
	err := json.Unmarshal([]byte(`{"location_id":1,"service_id":2}`), &sub)
	if err != nil {
		t.Fatalf("unmarshal subscription: %v", err)
	}
	if !sub.ConnectedAt.IsZero() {
		t.Fatalf("connected_at = %v, want zero value", sub.ConnectedAt)
	}
}
