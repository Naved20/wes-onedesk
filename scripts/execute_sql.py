import os
import sys
import json
import urllib.request
import urllib.error

def execute_sql(migration_file):
    # Load .env variables
    env_vars = {}
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip()
                    
    url = env_vars.get('VITE_SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL')
    service_role = env_vars.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not service_role:
        print("Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env or environment")
        sys.exit(1)
        
    migration_path = os.path.join('supabase', 'migrations', migration_file)
    if not os.path.exists(migration_path):
        print(f"Error: Migration file not found: {migration_path}")
        sys.exit(1)
        
    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()
        
    rpc_url = f"{url.rstrip('/')}/rest/v1/rpc/exec_sql"
    data = json.dumps({"sql_string": sql}).encode('utf-8')
    
    req = urllib.request.Request(
        rpc_url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'apikey': service_role,
            'Authorization': f'Bearer {service_role}'
        },
        method='POST'
    )
    
    print(f"Applying migration {migration_file} via REST RPC...")
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            print("Response status:", response.status)
            print("Response body:", res_body)
            print("Migration applied successfully!")
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code)
        print(e.read().decode('utf-8'))
        sys.exit(1)
    except Exception as e:
        print("Error:", str(e))
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scripts/execute_sql.py <migration_file>")
        sys.exit(1)
    execute_sql(sys.argv[1])
