package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/rguziy/billcore/internal/db"
	"github.com/rguziy/billcore/internal/domain"
)

type UserRepo struct {
	db *db.DB
}

func NewUserRepo(db *db.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) GetAll(ctx context.Context) ([]domain.User, error) {
	// Execute raw select query using the thread-safe connection pool
	rows, err := r.db.Pool().Query(ctx, `
		SELECT id, username, email, role, preferred_language, is_active, created_at, updated_at
		FROM billcore.users
		ORDER BY username
	`)
	if err != nil {
		return nil, fmt.Errorf("users get all: %w", err)
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		var u domain.User
		var email *string
		var lang *string
		if err := rows.Scan(&u.ID, &u.Username, &email, &u.Role, &lang, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("users scan: %w", err)
		}
		if email != nil {
			u.Email = *email
		}
		if lang != nil {
			u.PreferredLanguage = domain.Language(*lang)
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id int) (*domain.User, error) {
	var u domain.User
	var email *string
	var lang *string
	// Fetch user row using the thread-safe connection pool
	err := r.db.Pool().QueryRow(ctx, `
		SELECT id, username, email, role, preferred_language, is_active, created_at, updated_at
		FROM billcore.users WHERE id = $1
	`, id).Scan(&u.ID, &u.Username, &email, &u.Role, &lang, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("user get by id: %w", err)
	}
	if email != nil {
		u.Email = *email
	}
	if lang != nil {
		u.PreferredLanguage = domain.Language(*lang)
	}
	return &u, nil
}

func (r *UserRepo) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
	var u domain.User
	var email *string
	var lang *string
	// Fetch user row using the thread-safe connection pool
	err := r.db.Pool().QueryRow(ctx, `
		SELECT id, username, email, password_hash, role, preferred_language, is_active, created_at, updated_at
		FROM billcore.users WHERE username = $1
	`, username).Scan(&u.ID, &u.Username, &email, &u.PasswordHash, &u.Role, &lang, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	if email != nil {
		u.Email = *email
	}
	if lang != nil {
		u.PreferredLanguage = domain.Language(*lang)
	}
	return &u, nil
}

func (r *UserRepo) Create(ctx context.Context, u *domain.User) error {
	var email *string
	if u.Email != "" {
		email = &u.Email
	}
	lang := domain.DefaultLanguage()
	if u.PreferredLanguage != "" {
		lang = u.PreferredLanguage
	}
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO billcore.users (username, email, password_hash, role, preferred_language)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, created_at, updated_at
		`, u.Username, email, u.PasswordHash, u.Role, lang,
		).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	})
}

func (r *UserRepo) Update(ctx context.Context, u *domain.User) error {
	var email *string
	if u.Email != "" {
		email = &u.Email
	}
	lang := domain.DefaultLanguage()
	if u.PreferredLanguage != "" {
		lang = u.PreferredLanguage
	}
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE billcore.users SET username = $1, email = $2, role = $3, preferred_language = $4 WHERE id = $5
		`, u.Username, email, u.Role, lang, u.ID)
		return err
	})
}

func (r *UserRepo) SetPreferredLanguage(ctx context.Context, id int, language domain.Language) error {
	if !domain.IsSupportedLanguage(string(language)) {
		return fmt.Errorf("unsupported language: %s", language)
	}
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE billcore.users SET preferred_language = $1 WHERE id = $2`, language, id)
		return err
	})
}

func (r *UserRepo) SetActive(ctx context.Context, id int, active bool) error {
	// Execute state verification and update safely inside a single transaction scope
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		// Cannot deactivate the last active admin
		if !active {
			var activeAdmins int
			if err := tx.QueryRow(ctx, `
				SELECT COUNT(*) FROM billcore.users
				WHERE role = 'admin' AND is_active = TRUE AND id != $1
			`, id).Scan(&activeAdmins); err != nil {
				return fmt.Errorf("check admins: %w", err)
			}
			if activeAdmins == 0 {
				return fmt.Errorf("cannot deactivate the last active admin")
			}
		}
		_, err := tx.Exec(ctx, `UPDATE billcore.users SET is_active = $1 WHERE id = $2`, active, id)
		return err
	})
}

func (r *UserRepo) SetPassword(ctx context.Context, id int, hash string) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE billcore.users SET password_hash = $1 WHERE id = $2`, hash, id)
		return err
	})
}

// HasHistory returns true if user has created or updated any records.
func (r *UserRepo) HasHistory(ctx context.Context, id int) (bool, error) {
	tables := []string{"clients", "locations", "services", "tariffs", "subscriptions", "calculations", "periods"}
	// Perform isolated checks sequentially via the thread-safe connection pool
	for _, t := range tables {
		var count int
		if err := r.db.Pool().QueryRow(ctx, fmt.Sprintf(`
			SELECT COUNT(*) FROM billcore.%s WHERE created_by = $1 OR updated_by = $1 LIMIT 1
		`, t), id).Scan(&count); err != nil {
			return false, err
		}
		if count > 0 {
			return true, nil
		}
	}
	return false, nil
}

func (r *UserRepo) Delete(ctx context.Context, id int) error {
	// Execute history checks and deletion atomically inside a transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		tables := []string{"clients", "locations", "services", "tariffs", "subscriptions", "calculations", "periods"}
		for _, t := range tables {
			var count int
			if err := tx.QueryRow(ctx, fmt.Sprintf(`
				SELECT COUNT(*) FROM billcore.%s WHERE created_by = $1 OR updated_by = $1 LIMIT 1
			`, t), id).Scan(&count); err != nil {
				return fmt.Errorf("check history on %s: %w", t, err)
			}
			if count > 0 {
				return fmt.Errorf("cannot delete user with action history")
			}
		}

		_, err := tx.Exec(ctx, `DELETE FROM billcore.users WHERE id = $1`, id)
		return err
	})
}
