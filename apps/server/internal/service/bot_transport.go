package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type telegramSendOptions struct {
	ReplyMarkup           any
	DisableWebPagePreview bool
	ReplyToMessageID      string
}

type telegramResolvedFile struct {
	FileID       string
	FilePath     string
	FileUniqueID string
	FileSize     int64
}

func (s *Service) sendTelegramMessageWithOptions(
	ctx context.Context,
	botKey string,
	chatID string,
	message string,
	options telegramSendOptions,
) (telegramSendResult, error) {
	config, err := s.resolveTelegramCredentials(ctx, botKey)
	if err != nil {
		return telegramSendResult{}, err
	}

	if strings.TrimSpace(chatID) == "" || strings.TrimSpace(message) == "" {
		return telegramSendResult{}, ErrInvalidInput
	}

	payload := map[string]any{
		"chat_id":                  chatID,
		"text":                     message,
		"disable_web_page_preview": true,
	}
	if options.ReplyMarkup != nil {
		payload["reply_markup"] = options.ReplyMarkup
	}
	if strings.TrimSpace(options.ReplyToMessageID) != "" {
		if messageID, ok := parseUintRoute(options.ReplyToMessageID); ok {
			payload["reply_to_message_id"] = messageID
		}
	}
	var envelope struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
		Result      struct {
			MessageID int64 `json:"message_id"`
			Chat      struct {
				ID int64 `json:"id"`
			} `json:"chat"`
		} `json:"result"`
	}
	if err := s.telegramAPIJSONRequest(ctx, config, "sendMessage", payload, &envelope); err != nil {
		return telegramSendResult{}, err
	}

	resolvedChatID := strings.TrimSpace(chatID)
	if envelope.Result.Chat.ID != 0 {
		resolvedChatID = fmt.Sprintf("%d", envelope.Result.Chat.ID)
	}

	return telegramSendResult{
		BotKey:    config.BotKey,
		ChatID:    resolvedChatID,
		MessageID: fmt.Sprintf("%d", envelope.Result.MessageID),
		SentAt:    time.Now(),
	}, nil
}

func (s *Service) answerTelegramCallbackQuery(
	ctx context.Context,
	botKey string,
	callbackQueryID string,
	text string,
	showAlert bool,
) error {
	if strings.TrimSpace(callbackQueryID) == "" {
		return nil
	}

	config, err := s.resolveTelegramCredentials(ctx, botKey)
	if err != nil {
		return err
	}

	payload := map[string]any{
		"callback_query_id": callbackQueryID,
	}
	if strings.TrimSpace(text) != "" {
		payload["text"] = strings.TrimSpace(text)
	}
	if showAlert {
		payload["show_alert"] = true
	}

	return s.telegramAPIJSONRequest(ctx, config, "answerCallbackQuery", payload, nil)
}

func (s *Service) getTelegramFile(ctx context.Context, botKey string, fileID string) (telegramResolvedFile, error) {
	config, err := s.resolveTelegramCredentials(ctx, botKey)
	if err != nil {
		return telegramResolvedFile{}, err
	}
	if strings.TrimSpace(fileID) == "" {
		return telegramResolvedFile{}, ErrInvalidInput
	}

	var envelope struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
		Result      struct {
			FileID       string `json:"file_id"`
			FileUniqueID string `json:"file_unique_id"`
			FileSize     int64  `json:"file_size"`
			FilePath     string `json:"file_path"`
		} `json:"result"`
	}
	if err := s.telegramAPIJSONRequest(ctx, config, "getFile", map[string]any{"file_id": strings.TrimSpace(fileID)}, &envelope); err != nil {
		return telegramResolvedFile{}, err
	}

	return telegramResolvedFile{
		FileID:       strings.TrimSpace(envelope.Result.FileID),
		FileUniqueID: strings.TrimSpace(envelope.Result.FileUniqueID),
		FileSize:     envelope.Result.FileSize,
		FilePath:     strings.TrimSpace(envelope.Result.FilePath),
	}, nil
}

func (s *Service) downloadTelegramFile(ctx context.Context, botKey string, filePath string) ([]byte, error) {
	config, err := s.resolveTelegramCredentials(ctx, botKey)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(filePath) == "" {
		return nil, ErrInvalidInput
	}

	response, err := executeRetriedHTTPRequest(
		defaultTelegramSafeRetryAttempts,
		func() (*http.Request, error) {
			return http.NewRequestWithContext(
				ctx,
				http.MethodGet,
				fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", config.BotToken, strings.TrimLeft(strings.TrimSpace(filePath), "/")),
				nil,
			)
		},
		(&http.Client{Timeout: 20 * time.Second}).Do,
		shouldRetryTransientHTTPRequest,
	)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	if response.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("telegram file download failed: status %d", response.StatusCode)
	}

	return body, nil
}

func (s *Service) telegramAPIJSONRequest(
	ctx context.Context,
	config TelegramBotRuntimeConfig,
	method string,
	payload any,
	target any,
) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	attempts := 1
	if telegramAPIMethodAllowsRetry(method) {
		attempts = defaultTelegramSafeRetryAttempts
	}

	response, err := executeRetriedHTTPRequest(
		attempts,
		func() (*http.Request, error) {
			request, buildErr := http.NewRequestWithContext(
				ctx,
				http.MethodPost,
				fmt.Sprintf("https://api.telegram.org/bot%s/%s", config.BotToken, strings.TrimSpace(method)),
				bytes.NewReader(body),
			)
			if buildErr != nil {
				return nil, buildErr
			}
			request.Header.Set("Content-Type", "application/json")
			return request, nil
		},
		(&http.Client{Timeout: 10 * time.Second}).Do,
		shouldRetryTransientHTTPRequest,
	)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return err
	}

	if target != nil {
		if err := json.Unmarshal(responseBody, target); err != nil {
			return fmt.Errorf("telegram api decode failed: %w", err)
		}
	}

	if response.StatusCode >= http.StatusBadRequest {
		description := strings.TrimSpace(string(responseBody))
		if description == "" {
			description = fmt.Sprintf("telegram api returned status %d", response.StatusCode)
		}
		return fmt.Errorf("telegram request failed: %s", description)
	}

	if target == nil {
		var envelope struct {
			OK          bool   `json:"ok"`
			Description string `json:"description"`
		}
		if err := json.Unmarshal(responseBody, &envelope); err != nil {
			return fmt.Errorf("telegram api decode failed: %w", err)
		}
		if !envelope.OK {
			description := strings.TrimSpace(envelope.Description)
			if description == "" {
				description = strings.TrimSpace(string(responseBody))
			}
			return fmt.Errorf("telegram request failed: %s", description)
		}
		return nil
	}

	var okEnvelope struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(responseBody, &okEnvelope); err != nil {
		return fmt.Errorf("telegram api decode failed: %w", err)
	}
	if !okEnvelope.OK {
		description := strings.TrimSpace(okEnvelope.Description)
		if description == "" {
			description = strings.TrimSpace(string(responseBody))
		}
		return fmt.Errorf("telegram request failed: %s", description)
	}

	return nil
}
