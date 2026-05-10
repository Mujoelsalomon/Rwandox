import os
import sys
try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except Exception as e:
    print('ERROR: psycopg2 not available:', e)
    sys.exit(2)

host = os.getenv('POSTGRES_HOST', 'localhost')
port = os.getenv('POSTGRES_PORT', '5432')
user = os.getenv('POSTGRES_USER', 'postgres')
password = os.getenv('POSTGRES_PASSWORD', 'postgres')
dbname = os.getenv('POSTGRES_DB', 'postop')

def main():
    try:
        conn = psycopg2.connect(dbname='postgres', user=user, password=password, host=host, port=port)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (dbname,))
        if cur.fetchone():
            print(f"Database '{dbname}' already exists")
        else:
            cur.execute(f'CREATE DATABASE "{dbname}"')
            print(f"Database '{dbname}' created")
        cur.close()
        conn.close()
        return 0
    except Exception as exc:
        print('ERROR creating database:', exc)
        return 1

if __name__ == '__main__':
    sys.exit(main())
