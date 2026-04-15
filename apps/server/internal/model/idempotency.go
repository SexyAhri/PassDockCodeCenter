package model

type IdempotencyRecord struct {
	BaseModel
	Scope        string `gorm:"not null;uniqueIndex:uk_idempotency_records_scope" json:"scope"`
	RequestHash  string `gorm:"not null" json:"request_hash"`
	StatusCode   int    `gorm:"not null;default:200" json:"status_code"`
	ResponseBody string `gorm:"type:text" json:"response_body"`
}
