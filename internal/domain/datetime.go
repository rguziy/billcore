// Package domain provides shared domain types and helpers.
package domain

import (
    "fmt"
    "strings"
    "time"
)

// parseJSONDateTime parses a date string that may be in YYYY‑MM‑DD (DateOnly) or RFC3339 format.
// It trims surrounding whitespace and returns an error if the value is empty.
func parseJSONDateTime(value string) (time.Time, error) {
    value = strings.TrimSpace(value)
    if value == "" {
        return time.Time{}, fmt.Errorf("date is required")
    }
    if t, err := time.Parse(time.DateOnly, value); err == nil {
        return t, nil
    }
    return time.Parse(time.RFC3339, value)
}
