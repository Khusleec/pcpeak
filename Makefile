.PHONY: start stop restart logs ps build rebuild clean full test

start:
	@node infra/scripts/start.js

full:
	@node infra/scripts/start.js --full

stop:
	@docker compose down

restart: stop start

logs:
	@docker compose logs -f

ps:
	@docker compose ps

build:
	@docker compose build

rebuild:
	@docker compose build --no-cache && node infra/scripts/start.js

clean:
	@docker compose down -v --remove-orphans

test:
	@cd frontend && npm test
	@cd backend/core-api && npm test

# Локал MySQL dump (Git Bash / WSL): make db-dump-local
db-dump-local:
	@bash scripts/db-dump-local.sh
