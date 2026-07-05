package model

type ResellerAdmin struct {
	Id               string `json:"id" gorm:"primaryKey"`
	Remark           string `json:"remark"`
	Username         string `json:"username" gorm:"uniqueIndex"`
	Password         string `json:"password,omitempty"`
	VolumeGB         int64  `json:"volumeGB"`
	Days             int    `json:"days"`
	WebPath          string `json:"webPath" gorm:"uniqueIndex"`
	Inbounds         string `json:"inbounds"` // Comma-separated inbound IDs
	CreatedAt        int64  `json:"createdAt"`
	ExpiryTime       int64  `json:"expiryTime"`
	Enable           bool   `json:"enable"`
	ClientsCount     int    `json:"clientsCount" gorm:"-"`
	TrafficUsedBytes int64  `json:"trafficUsedBytes" gorm:"-"`
}
