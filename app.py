from flask import Flask, request, jsonify, render_template, redirect, session, send_file, abort
import os
from flask_cors import CORS
from datetime import datetime
import re
import pandas as pd
from io import BytesIO
from psycopg_pool import ConnectionPool

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = 'your_secret_key_here'
CORS(app, supports_credentials=True)  # ✅ allow cookies across requests

# ✅ Database Pool
DB_URL = os.environ.get("DATABASE_URL",
    "postgresql://games_wme8_user:g4Zzb8DOnUU3eoJePAYh9xO7XwdRqBxv@dpg-d23tg1ili9vc73felil0-a.oregon-postgres.render.com/games_wme8")
pool = ConnectionPool(conninfo=DB_URL, min_size=1, max_size=20, timeout=60)

def get_conn():
    return pool.connection()

# ✅ Warm-up
def warmup_db():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        print("✅ DB Warmup OK")
    except Exception as e:
        print("⚠️ DB Warmup failed:", e)

# ✅ Constants
POINT_SYSTEM = {1:10, 2:9, 3:8, 4:7, 5:6, 6:5, 7:4, 8:3, 9:2, 10:1}
ADMIN_USERNAME = "adminU"
ADMIN_PASSWORD = "amdinSF"

# ✅ Load Default Games
DEFAULT_GAMES = []
with open("games.txt") as f:
    DEFAULT_GAMES = [line.strip() for line in f]

# ✅ Init DB
def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE,
                total_points INTEGER DEFAULT 0,
                vote_count INTEGER DEFAULT 0
            )""")
            cur.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                id SERIAL PRIMARY KEY,
                voter_name TEXT,
                game TEXT,
                rank INTEGER,
                points INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_games_name ON games (name)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes (voter_name)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_votes_game ON votes (game)")
            cur.execute("SELECT COUNT(*) FROM games")
            if cur.fetchone()[0] == 0:
                for g in DEFAULT_GAMES:
                    cur.execute("INSERT INTO games (name) VALUES (%s) ON CONFLICT DO NOTHING", (g,))
        conn.commit()

# ✅ Update Rankings (ONLY used when admin downloads Excel)
def calculate_rankings():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE games g SET
                    total_points = COALESCE((SELECT SUM(points) FROM votes WHERE game=g.name), 0),
                    vote_count   = COALESCE((SELECT COUNT(*) FROM votes WHERE game=g.name), 0)
            """)
        conn.commit()

# ✅ Helpers
def sanitize_input(text):
    return re.sub(r'[;\'"\\&/*]', '', text).strip() if text else text

def validate_votes(votes):
    return len(votes) == 10 and all(isinstance(v, str) and v.strip() for v in votes)

# ✅ Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/results')
def results():
    username = request.args.get('username')
    return render_template('results.html', username=username) if username else redirect('/')

@app.route('/user-results/<username>')
def user_results(username):
    username = sanitize_input(username)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, game, rank, points, timestamp FROM votes WHERE voter_name=%s ORDER BY rank", (username,))
            rows = cur.fetchall()
            cur.execute("SELECT COUNT(DISTINCT voter_name) FROM votes")
            total_voters = cur.fetchone()[0]

    if not rows:
        return jsonify({'status': 'success','username': username,'user_id': None,'votes': [],'total_voters': total_voters,'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')})

    votes = [{'game': r[1], 'rank': r[2], 'points': r[3]} for r in rows]
    return jsonify({'status': 'success','username': username,'user_id': rows[0][0],'votes': votes,'total_voters': total_voters,'timestamp': rows[0][4]})

@app.route('/games')
def get_games():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name, total_points, vote_count FROM games ORDER BY total_points DESC, name ASC")
            games = [{"name": r[0], "total_points": r[1], "vote_count": r[2]} for r in cur.fetchall()]
    return jsonify(games)

@app.route('/check-vote', methods=['POST'])
def check_vote():
    name = sanitize_input(request.get_json().get('name', ''))
    if not name:
        return jsonify({'status': 'error', 'message': 'Name is required'}), 400
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT game, rank, points FROM votes WHERE voter_name=%s ORDER BY rank", (name,))
            votes = cur.fetchall()
    return jsonify({'status': 'exists','votes': [{'game': v[0], 'rank': v[1], 'points': v[2]} for v in votes]}) if votes else jsonify({'status': 'new'})

@app.route('/submit', methods=['POST'])
def submit_vote():
    data = request.get_json()
    name = sanitize_input(data.get('name', ''))
    votes = data.get('votes', [])

    if not name or not validate_votes(votes):
        return jsonify({'status': 'error', 'message': 'Invalid submission'}), 400

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM votes WHERE voter_name=%s", (name,))
                if cur.fetchone():
                    return jsonify({'status': 'error', 'message': 'You have already voted'}), 403

                sanitized_games = [sanitize_input(g) for g in votes]
                cur.executemany("INSERT INTO games (name) VALUES (%s) ON CONFLICT DO NOTHING", [(g,) for g in sanitized_games])

                vote_records = [(name, g, r, POINT_SYSTEM[r]) for r, g in enumerate(sanitized_games, start=1)]
                cur.executemany("INSERT INTO votes (voter_name, game, rank, points) VALUES (%s,%s,%s,%s)", vote_records)

            conn.commit()
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

    return jsonify({'status': 'success'})

# ✅ Admin Panel
@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/admin-login', methods=['POST'])
def admin_login():
    data = request.get_json()
    if data.get('password') == ADMIN_PASSWORD:
        session['is_admin'] = True
        session.permanent = True   # ✅ persist session
        return jsonify({'status': 'success'})
    return jsonify({'status': 'fail', 'message': 'كلمة المرور غير صحيحة'}), 401

@app.route('/admin/view-table')
def view_table():
    if not session.get('is_admin'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    table = request.args.get('table', 'games')
    page = int(request.args.get('page', 1))
    search = request.args.get('search', '').strip()
    limit, offset = 50, (page - 1) * 50

    if table not in ["games", "votes"]:
        return jsonify({"status": "error", "message": "Invalid table"}), 400

    where, params = "", []
    if search:
        if table == "games":
            where = "WHERE name ILIKE %s"
            params.append(f"%{search}%")
        elif table == "votes":
            # ✅ Search by voter name OR game name
            where = "WHERE voter_name ILIKE %s OR game ILIKE %s"
            params.extend([f"%{search}%", f"%{search}%"])

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {table} {where}", params)
            total_rows = cur.fetchone()[0]
            params += [limit, offset]
            cur.execute(f"SELECT * FROM {table} {where} ORDER BY id ASC LIMIT %s OFFSET %s", params)
            rows = cur.fetchall()
            col_names = [desc[0] for desc in cur.description]

    return jsonify({"status": "success","table": table,"columns": col_names,"rows": rows,"total_rows": total_rows,"page": page,"pages": (total_rows + limit - 1)//limit,"has_pagination": total_rows > limit})


@app.route('/admin/vote/<int:vid>', methods=['PUT'])
def edit_vote(vid):
    if not session.get('is_admin'):
        return abort(403)

    data = request.get_json()
    new_game = sanitize_input(data.get('game', ''))
    new_rank = data.get('rank')
    new_points = POINT_SYSTEM.get(new_rank, data.get('points'))

    if not new_game or not new_rank:
        return jsonify({"status": "error", "message": "Game and rank required"}), 400

    with get_conn() as conn:
        with conn.cursor() as cur:
            # ✅ Update vote record
            cur.execute("""
                UPDATE votes SET game=%s, rank=%s, points=%s
                WHERE id=%s
            """, (new_game, new_rank, new_points, vid))

            # ✅ Ensure game exists in games table
            cur.execute("INSERT INTO games (name) VALUES (%s) ON CONFLICT DO NOTHING", (new_game,))
            conn.commit()

    return jsonify({"status": "success"})



# ✅ Admin Modify + Excel Export
@app.route('/admin/game', methods=['POST'])
def add_game():
    if not session.get('is_admin'): return abort(403)
    name = sanitize_input(request.get_json().get('name', ''))
    if not name: return jsonify({"status": "error", "message": "Game name required"}), 400
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO games (name) VALUES (%s) ON CONFLICT DO NOTHING", (name,))
            conn.commit()
            cur.execute("SELECT id FROM games WHERE name=%s", (name,))
            return jsonify({"status": "success" if cur.fetchone() else "error"})

@app.route('/admin/game/<int:gid>', methods=['PUT'])
def edit_game(gid):
    if not session.get('is_admin'): return abort(403)
    new_name = sanitize_input(request.get_json().get('name', ''))
    if not new_name: return jsonify({"status": "error", "message": "New name required"}), 400
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE games SET name=%s WHERE id=%s", (new_name, gid))
            conn.commit()
    return jsonify({"status": "success"})

@app.route('/admin/game/<int:gid>', methods=['DELETE'])
def delete_game(gid):
    if not session.get('is_admin'): return abort(403)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM games WHERE id=%s", (gid,))
            conn.commit()
    return jsonify({"status": "success"})

@app.route('/admin/vote/<int:vid>', methods=['DELETE'])
def delete_vote(vid):
    if not session.get('is_admin'): return abort(403)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM votes WHERE id=%s", (vid,))
            conn.commit()
    return jsonify({"status": "success"})


@app.route('/check-name', methods=['POST'])
def check_name():
    name = request.get_json().get('name', '').strip()
    if name == ADMIN_USERNAME:
        return jsonify(status='admin')
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM votes WHERE voter_name=%s", (name,))
            return jsonify(status='exists' if cur.fetchone() else 'new')

# ✅ Excel Export (only here we recalc rankings)
@app.route('/download-excel')
def download_excel():
    if not session.get('is_admin'):
        return abort(403)
    
    calculate_rankings()

    output = BytesIO()
    with get_conn() as conn:
        with conn.cursor() as cur:
            # ✅ Query game rankings with correct ROUND
            cur.execute("""
                SELECT ROW_NUMBER() OVER (ORDER BY total_points DESC) AS rank,
                       name AS game,
                       total_points,
                       vote_count,
                       ROUND((total_points::numeric / NULLIF(vote_count,0)), 2) AS avg_points
                FROM games
                WHERE vote_count > 0
                ORDER BY total_points DESC
            """)
            rankings_data = cur.fetchall()
            rankings_columns = [desc[0] for desc in cur.description]

            # ✅ Query all votes
            cur.execute("SELECT voter_name, game, rank, points, timestamp FROM votes ORDER BY timestamp DESC")
            votes_data = cur.fetchall()
            votes_columns = [desc[0] for desc in cur.description]

    # ✅ Convert query results to DataFrames
    rankings_df = pd.DataFrame(rankings_data, columns=rankings_columns)
    votes_df = pd.DataFrame(votes_data, columns=votes_columns)

    # ✅ Write to Excel
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        rankings_df.to_excel(writer, sheet_name='Game Rankings', index=False)
        votes_df.to_excel(writer, sheet_name='All Votes', index=False)

    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="tg_votes_db.xlsx",
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

# ✅ Start App
if __name__ == '__main__':
    print("🔄 Initializing PostgreSQL database...")
    init_db()
    warmup_db()
    print("✅ Ready. Server running...")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
