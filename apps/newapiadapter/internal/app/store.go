package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type IssueRecord struct {
	OrderNo       string    `json:"order_no"`
	Kind          string    `json:"kind"`
	ExpectedCount int       `json:"expected_count"`
	Codes         []string  `json:"codes"`
	Status        string    `json:"status"`
	Message       string    `json:"message"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Store struct {
	path  string
	mu    sync.Mutex
	items map[string]IssueRecord
}

func NewStore(path string) (*Store, error) {
	store := &Store{
		path:  path,
		items: map[string]IssueRecord{},
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) Get(orderNo string) (IssueRecord, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, ok := s.items[orderNo]
	if !ok {
		return IssueRecord{}, false
	}
	record.Codes = append([]string{}, record.Codes...)
	return record, true
}

func (s *Store) Upsert(record IssueRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	record.Codes = append([]string{}, record.Codes...)
	if record.CreatedAt.IsZero() {
		if existing, exists := s.items[record.OrderNo]; exists {
			record.CreatedAt = existing.CreatedAt
		} else {
			record.CreatedAt = time.Now().UTC()
		}
	}
	record.UpdatedAt = time.Now().UTC()
	s.items[record.OrderNo] = record
	return s.save()
}

func (s *Store) load() error {
	content, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if len(content) == 0 {
		return nil
	}
	return json.Unmarshal(content, &s.items)
}

func (s *Store) save() error {
	content, err := json.MarshalIndent(s.items, "", "  ")
	if err != nil {
		return err
	}
	tempPath := s.path + ".tmp"
	if err := os.WriteFile(tempPath, content, 0o644); err != nil {
		return err
	}
	return os.Rename(tempPath, s.path)
}
