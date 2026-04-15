package model

type RuntimeSetting struct {
	BaseModel
	Module      string `gorm:"not null;index:idx_runtime_settings_module_scope,priority:1" json:"module"`
	Name        string `gorm:"not null;uniqueIndex:uk_runtime_settings_name" json:"name"`
	Value       string `gorm:"not null" json:"value"`
	Scope       string `gorm:"not null;default:db;index:idx_runtime_settings_module_scope,priority:2" json:"scope"`
	Description string `json:"description"`
}
