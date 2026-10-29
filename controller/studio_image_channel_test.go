/*
Copyright (C) 2023-2026 QuantumNous
Copyright (C) 2026 CubeRouter

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStudioReviewerHealthFailuresAreCounted(t *testing.T) {
	setupModelListControllerTestDB(t)
	channel := &model.Channel{Id: 1, Type: constant.ChannelTypeStudioReview, Status: common.ChannelStatusEnabled}
	result := testChannel(context.Background(), channel, 1, "", "", false)
	require.NotNil(t, result.context, "automatic health transitions need a context for the channel key")
	summary := testChannelForHealthCheck(context.Background(), channel, 1, false, 100000)
	assert.Equal(t, 1, summary.Tested)
	assert.Equal(t, 1, summary.Failed)
	assert.Zero(t, summary.Succeeded)
	assert.Zero(t, summary.Disabled)
}

func TestStudioReviewerSaveRejectsFinalMultiKeyState(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	base := "http://127.0.0.1:19001/moderate"
	channel := &model.Channel{Type: constant.ChannelTypeStudioReview, Name: "reviewer", Key: strings.Repeat("s", 32), BaseURL: &base}
	t.Run("add mode sets multi key after initial validation", func(t *testing.T) {
		payload, err := common.Marshal(AddChannelRequest{Mode: "multi_to_single", Channel: channel})
		require.NoError(t, err)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/", bytes.NewReader(payload))
		c.Request.Header.Set("Content-Type", "application/json")
		AddChannel(c)
		var result struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
		assert.False(t, result.Success)
		assert.Contains(t, result.Message, "one service key")
		var count int64
		require.NoError(t, db.Model(&model.Channel{}).Count(&count).Error)
		assert.Zero(t, count)
	})
	t.Run("edit restores stored multi key state", func(t *testing.T) {
		stored := *channel
		stored.Id = 8
		stored.ChannelInfo.IsMultiKey = true
		require.NoError(t, db.Create(&stored).Error)
		payload, err := common.Marshal(map[string]any{"id": 8, "type": constant.ChannelTypeStudioReview, "base_url": base, "name": "edited"})
		require.NoError(t, err)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPut, "/api/channel/", bytes.NewReader(payload))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Set("id", 1)
		c.Set("role", common.RoleRootUser)
		UpdateChannel(c)
		var result struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
		assert.False(t, result.Success)
		assert.Contains(t, result.Message, "one service key")
		var unchanged model.Channel
		require.NoError(t, db.First(&unchanged, 8).Error)
		assert.Equal(t, "reviewer", unchanged.Name)
	})
}
