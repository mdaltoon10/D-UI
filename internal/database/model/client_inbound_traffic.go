package model

// ClientInboundTraffic stores accurate per-client, per-inbound usage.
// client_traffics remains the compatibility rollup used by existing quota,
// disable, reset, subscription and reporting paths.
type ClientInboundTraffic struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ClientID     int    `json:"clientId" gorm:"column:client_id;not null;uniqueIndex:idx_client_inbound_traffic_pair"`
	InboundID    int    `json:"inboundId" gorm:"column:inbound_id;not null;uniqueIndex:idx_client_inbound_traffic_pair;index"`
	Email        string `json:"email" gorm:"column:email;not null;index"`
	StatEmail    string `json:"statEmail" gorm:"column:stat_email;not null;uniqueIndex"`
	ActualUp     int64  `json:"actualUp" gorm:"column:actual_up;not null;default:0"`
	ActualDown   int64  `json:"actualDown" gorm:"column:actual_down;not null;default:0"`
	BillableUp   int64  `json:"billableUp" gorm:"column:billable_up;not null;default:0"`
	BillableDown int64  `json:"billableDown" gorm:"column:billable_down;not null;default:0"`
	LastOnline   int64  `json:"lastOnline" gorm:"column:last_online;not null;default:0"`
	CreatedAt    int64  `json:"createdAt" gorm:"column:created_at;not null;default:0"`
	UpdatedAt    int64  `json:"updatedAt" gorm:"column:updated_at;not null;default:0"`
}

func (ClientInboundTraffic) TableName() string {
	return "client_inbound_traffics"
}
