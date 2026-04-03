export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "DROP DATABASE IF EXISTS canvas_studio WITH (FORCE);"
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "CREATE DATABASE canvas_studio OWNER postgres ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0;"