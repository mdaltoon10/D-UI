package model

type ResellerAdmin struct {
	Id               string `json:"id" gorm:"primaryKey"`
	Remark           string `json:"remark"`
	Username         string `json:"username" gorm:"uniqueIndex"`
	Password         string `json:"password,omitempty"`
	RawPassword      string `json:"rawPassword,omitempty"` // Store plain/raw password so the eye icon can display it
	VolumeGB         int64  `json:"volumeGB"`
	Days             int    `json:"days"`
	WebPath          string `json:"webPath" gorm:"uniqueIndex"`
	Inbounds         string `json:"inbounds"` // Comma-separated inbound IDs
	CreatedAt           int64  `json:"createdAt"`
	ExpiryTime          int64  `json:"expiryTime"`
	Enable              bool   `json:"enable"`
	DeletedTrafficBytes int64  `json:"deletedTrafficBytes" gorm:"default:0"`
	ClientsCount        int    `json:"clientsCount" gorm:"-"`
	TrafficUsedBytes    int64  `json:"trafficUsedBytes" gorm:"-"`
}
