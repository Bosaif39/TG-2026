from flask import Flask, request, jsonify, render_template, redirect, session, send_file, abort
import os
from flask_cors import CORS
from datetime import datetime
import re
import pandas as pd
from io import BytesIO
import sqlite3

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = 'your_secret_key_here'
CORS(app, supports_credentials=True)  # ✅ allow cookies across requests

# ✅ Database Configuration - Use SQLite locally
DB_TYPE = os.environ.get('DB_TYPE', 'sqlite')  # Set to 'postgres' in production

if DB_TYPE == 'postgres':
    # PostgreSQL configuration (for Render.com)
    from psycopg_pool import ConnectionPool
    DB_URL = os.environ.get("DATABASE_URL")
    pool = ConnectionPool(conninfo=DB_URL, min_size=1, max_size=20, timeout=60)
    
    def get_conn():
        return pool.connection()
else:
    # SQLite configuration (for local development)
    DB_PATH = 'votes.db'
    
    def get_conn():
        """SQLite connection context manager"""
        class SQLiteConnection:
            def __enter__(self):
                self.conn = sqlite3.connect(DB_PATH)
                self.conn.row_factory = sqlite3.Row
                return self.conn
            
            def __exit__(self, exc_type, exc_val, exc_tb):
                self.conn.close()
        
        return SQLiteConnection()

# ✅ Warm-up
def warmup_db():
    try:
        with get_conn() as conn:
            if DB_TYPE == 'postgres':
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            else:
                # SQLite
                conn.execute("SELECT 1")
        print("✅ DB Warmup OK")
    except Exception as e:
        print("⚠️ DB Warmup failed:", e)

# ✅ Constants
POINT_SYSTEM = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}  # Top 5 points: 5,4,3,2,1
ADMIN_USERNAME = "adminU"
ADMIN_PASSWORD = "amdinSF"

# ✅ Load games from text file
def load_games_from_file():
    try:
        with open('game.txt', 'r', encoding='utf-8') as f:
            games = [line.strip() for line in f if line.strip()]
        print(f"✅ Loaded {len(games)} games from game.txt")
        return games
    except FileNotFoundError:
        print("⚠️ game.txt not found, using default game list")
        return [
            "The Legend of Zelda: Ocarina of Time", "Super Mario World", "Minecraft",
            "The Witcher 3: Wild Hunt", "Tetris", "Red Dead Redemption 2",
            "Portal 2", "Half-Life 2", "Dark Souls", "Grand Theft Auto V",
            "Mass Effect 2", "BioShock", "Metal Gear Solid", "Halo: Combat Evolved"
        ]

# ✅ Init DB with new structure
def init_db():
    with get_conn() as conn:
        if DB_TYPE == 'postgres':
            with conn.cursor() as cur:
                # Games table for autocomplete
                cur.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )""")
                
                # Publishers table
                cur.execute("""
                CREATE TABLE IF NOT EXISTS publishers (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )""")
                
                # Categories table
                cur.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name_ar TEXT UNIQUE NOT NULL,  # Arabic name
                    name_en TEXT UNIQUE NOT NULL,  # English name for reference
                    description TEXT,
                    display_order INTEGER DEFAULT 0
                )""")
                
                # Votes table (now with category_id and top 5)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS votes (
                    id SERIAL PRIMARY KEY,
                    voter_name TEXT NOT NULL,
                    category_id INTEGER NOT NULL,
                    rank INTEGER CHECK (rank BETWEEN 1 AND 5),
                    selection TEXT NOT NULL,
                    points INTEGER DEFAULT 0,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(voter_name, category_id, rank)
                )""")
                
                # Create indexes
                cur.execute("CREATE INDEX IF NOT EXISTS idx_games_name ON games (name)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers (name)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes (voter_name)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_votes_category ON votes (category_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_votes_selection ON votes (selection)")
                
                # Insert default games if table is empty
                cur.execute("SELECT COUNT(*) FROM games")
                if cur.fetchone()[0] == 0:
                    games = load_games_from_file()
                    for game in games:
                        cur.execute("""
                            INSERT INTO games (name) 
                            VALUES (%s)
                            ON CONFLICT DO NOTHING
                        """, (game,))
                    print(f"✅ Inserted {len(games)} games into database")
                
                # Insert default publishers if table is empty
                cur.execute("SELECT COUNT(*) FROM publishers")
                if cur.fetchone()[0] == 0:
                    default_publishers = [
                        "Electronic Arts",
                        "Activision Blizzard",
                        "Ubisoft",
                        "Nintendo",
                        "Sony Interactive Entertainment",
                        "Microsoft Xbox Game Studios",
                        "Take-Two Interactive",
                        "Bandai Namco Entertainment",
                        "Square Enix",
                        "Sega",
                        "Capcom",
                        "CD Projekt Red",
                        "Bethesda Softworks",
                        "Valve Corporation",
                        "Epic Games",
                        "Mojang Studios",
                        "Rockstar Games",
                        "FromSoftware",
                        "Blizzard Entertainment",
                        "Naughty Dog"
                    ]
                    for publisher in default_publishers:
                        cur.execute("""
                            INSERT INTO publishers (name) 
                            VALUES (%s)
                            ON CONFLICT DO NOTHING
                        """, (publisher,))
                    print(f"✅ Inserted {len(default_publishers)} publishers into database")
                
                # Insert default categories if table is empty
                cur.execute("SELECT COUNT(*) FROM categories")
                if cur.fetchone()[0] == 0:
                    default_categories = [
                        ("أفضل توسعة", "Best Expansion", "أفضل لعبة توسعة صدرت في 2025", 1),
                        ("أفضل قصة", "Best Story", "أفضل قصة في لعبة صدرت في 2025", 2),
                        ("أفضل توجه فني", "Best Art Direction", "أفضل توجه فني في لعبة صدرت في 2025", 3),
                        ("أفضل موسيقى", "Best Music", "أفضل موسيقى في لعبة صدرت في 2025", 4),
                        ("أفضل ناشر", "Best Publisher", "أفضل ناشر ألعاب في 2025", 5),
                        ("أفضل مفاجأة", "Best Surprise", "أفضل مفاجأة (لعبة/إعلان/معرض) في 2025", 6),
                        ("أكبر خيبة أمل", "Biggest Disappointment", "أكبر خيبة أمل (لعبة/إعلان/معرض) في 2025", 7),
                        ("أكثر لعبة تتطلع لها في 2026", "Most Anticipated 2026", "أكثر لعبة تتطلع لها في 2026 (يلزم تواجد تأكيد رسمي)", 8),
                        ("أفضل ألعاب 2025", "Best Games 2025", "أفضل 5 ألعاب صدرت في 2025 بشكل عام", 9)
                    ]
                    
                    for cat_ar, cat_en, desc, order in default_categories:
                        cur.execute("""
                            INSERT INTO categories (name_ar, name_en, description, display_order) 
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT DO NOTHING
                        """, (cat_ar, cat_en, desc, order))
        else:
            # SQLite
            # Games table for autocomplete
            conn.execute("""
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""")
            
            # Publishers table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS publishers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""")
            
            # Categories table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name_ar TEXT UNIQUE NOT NULL,
                name_en TEXT UNIQUE NOT NULL,
                description TEXT,
                display_order INTEGER DEFAULT 0
            )""")
            
            # Votes table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                voter_name TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                rank INTEGER CHECK (rank BETWEEN 1 AND 5),
                selection TEXT NOT NULL,
                points INTEGER DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(voter_name, category_id, rank)
            )""")
            
            # Create indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_games_name ON games (name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers (name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes (voter_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_votes_category ON votes (category_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_votes_selection ON votes (selection)")
            
            # Insert default games if table is empty
            cursor = conn.execute("SELECT COUNT(*) FROM games")
            if cursor.fetchone()[0] == 0:
                games = load_games_from_file()
                for game in games:
                    conn.execute("""
                        INSERT OR IGNORE INTO games (name) 
                        VALUES (?)
                    """, (game,))
                print(f"✅ Inserted {len(games)} games into database")
            
            # Insert default publishers if table is empty
            cursor = conn.execute("SELECT COUNT(*) FROM publishers")
            if cursor.fetchone()[0] == 0:
                default_publishers = [
                    "Electronic Arts",
                    "Activision Blizzard",
                    "Ubisoft",
                    "Nintendo",
                    "Sony Interactive Entertainment",
                    "Microsoft Xbox Game Studios",
                    "Take-Two Interactive",
                    "Bandai Namco Entertainment",
                    "Square Enix",
                    "Sega",
                    "Capcom",
                    "CD Projekt Red",
                    "Bethesda Softworks",
                    "Valve Corporation",
                    "Epic Games",
                    "Mojang Studios",
                    "Rockstar Games",
                    "FromSoftware",
                    "Blizzard Entertainment",
                    "Naughty Dog"
                ]
                for publisher in default_publishers:
                    conn.execute("""
                        INSERT OR IGNORE INTO publishers (name) 
                        VALUES (?)
                    """, (publisher,))
                print(f"✅ Inserted {len(default_publishers)} publishers into database")
            
            # Insert default categories if table is empty
            cursor = conn.execute("SELECT COUNT(*) FROM categories")
            if cursor.fetchone()[0] == 0:
                default_categories = [
                    ("أفضل توسعة", "Best Expansion", "أفضل لعبة توسعة صدرت في 2025", 1),
                    ("أفضل قصة", "Best Story", "أفضل قصة في لعبة صدرت في 2025", 2),
                    ("أفضل توجه فني", "Best Art Direction", "أفضل توجه فني في لعبة صدرت في 2025", 3),
                    ("أفضل موسيقى", "Best Music", "أفضل موسيقى في لعبة صدرت في 2025", 4),
                    ("أفضل ناشر", "Best Publisher", "أفضل ناشر ألعاب في 2025", 5),
                    ("أفضل مفاجأة", "Best Surprise", "أفضل مفاجأة (لعبة/إعلان/معرض) في 2025", 6),
                    ("أكبر خيبة أمل", "Biggest Disappointment", "أكبر خيبة أمل (لعبة/إعلان/معرض) في 2025", 7),
                    ("أكثر لعبة تتطلع لها في 2026", "Most Anticipated 2026", "أكثر لعبة تتطلع لها في 2026 (يلزم تواجد تأكيد رسمي)", 8),
                    ("أفضل ألعاب 2025", "Best Games 2025", "أفضل 5 ألعاب صدرت في 2025 بشكل عام", 9)
                ]
                
                for cat_ar, cat_en, desc, order in default_categories:
                    conn.execute("""
                        INSERT OR IGNORE INTO categories (name_ar, name_en, description, display_order) 
                        VALUES (?, ?, ?, ?)
                    """, (cat_ar, cat_en, desc, order))
        
        conn.commit()
        
    with get_conn() as conn:
        if DB_TYPE == 'postgres':
            with conn.cursor() as cur:
                # Games table for autocomplete
                cur.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )""")
                
                # Categories table
                cur.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name_ar TEXT UNIQUE NOT NULL,  # Arabic name
                    name_en TEXT UNIQUE NOT NULL,  # English name for reference
                    description TEXT,
                    display_order INTEGER DEFAULT 0
                )""")
                
                # Votes table (now with category_id and top 5)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS votes (
                    id SERIAL PRIMARY KEY,
                    voter_name TEXT NOT NULL,
                    category_id INTEGER NOT NULL,
                    rank INTEGER CHECK (rank BETWEEN 1 AND 5),
                    selection TEXT NOT NULL,
                    points INTEGER DEFAULT 0,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(voter_name, category_id, rank)
                )""")
                
                # Create indexes
                cur.execute("CREATE INDEX IF NOT EXISTS idx_games_name ON games (name)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes (voter_name)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_votes_category ON votes (category_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_votes_selection ON votes (selection)")
                
                # Insert default games if table is empty
                cur.execute("SELECT COUNT(*) FROM games")
                if cur.fetchone()[0] == 0:
                    games = load_games_from_file()
                    for game in games:
                        cur.execute("""
                            INSERT INTO games (name) 
                            VALUES (%s)
                            ON CONFLICT DO NOTHING
                        """, (game,))
                    print(f"✅ Inserted {len(games)} games into database")
                
                # Insert default categories if table is empty
                cur.execute("SELECT COUNT(*) FROM categories")
                if cur.fetchone()[0] == 0:
                    default_categories = [
                        ("أفضل توسعة", "Best Expansion", "أفضل لعبة توسعة صدرت في 2025", 1),
                        ("أفضل قصة", "Best Story", "أفضل قصة في لعبة صدرت في 2025", 2),
                        ("أفضل توجه فني", "Best Art Direction", "أفضل توجه فني في لعبة صدرت في 2025", 3),
                        ("أفضل موسيقى", "Best Music", "أفضل موسيقى في لعبة صدرت في 2025", 4),
                        ("أفضل ناشر", "Best Publisher", "أفضل ناشر ألعاب في 2025", 5),
                        ("أفضل مفاجأة", "Best Surprise", "أفضل مفاجأة (لعبة/إعلان/معرض) في 2025", 6),
                        ("أكبر خيبة أمل", "Biggest Disappointment", "أكبر خيبة أمل (لعبة/إعلان/معرض) في 2025", 7),
                        ("أكثر لعبة تتطلع لها في 2026", "Most Anticipated 2026", "أكثر لعبة تتطلع لها في 2026 (يلزم تواجد تأكيد رسمي)", 8),
                        ("أفضل ألعاب 2025", "Best Games 2025", "أفضل 5 ألعاب صدرت في 2025 بشكل عام", 9)
                    ]
                    
                    for cat_ar, cat_en, desc, order in default_categories:
                        cur.execute("""
                            INSERT INTO categories (name_ar, name_en, description, display_order) 
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT DO NOTHING
                        """, (cat_ar, cat_en, desc, order))
        else:
            # SQLite
            # Games table for autocomplete
            conn.execute("""
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""")
            
            # Categories table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name_ar TEXT UNIQUE NOT NULL,
                name_en TEXT UNIQUE NOT NULL,
                description TEXT,
                display_order INTEGER DEFAULT 0
            )""")
            
            # Votes table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                voter_name TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                rank INTEGER CHECK (rank BETWEEN 1 AND 5),
                selection TEXT NOT NULL,
                points INTEGER DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(voter_name, category_id, rank)
            )""")
            
            # Create indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_games_name ON games (name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes (voter_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_votes_category ON votes (category_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_votes_selection ON votes (selection)")
            
            # Insert default games if table is empty
            cursor = conn.execute("SELECT COUNT(*) FROM games")
            if cursor.fetchone()[0] == 0:
                games = load_games_from_file()
                for game in games:
                    conn.execute("""
                        INSERT OR IGNORE INTO games (name) 
                        VALUES (?)
                    """, (game,))
                print(f"✅ Inserted {len(games)} games into database")
            
            # Insert default categories if table is empty
            cursor = conn.execute("SELECT COUNT(*) FROM categories")
            if cursor.fetchone()[0] == 0:
                default_categories = [
                    ("أفضل توسعة", "Best Expansion", "أفضل لعبة توسعة صدرت في 2025", 1),
                    ("أفضل قصة", "Best Story", "أفضل قصة في لعبة صدرت في 2025", 2),
                    ("أفضل توجه فني", "Best Art Direction", "أفضل توجه فني في لعبة صدرت في 2025", 3),
                    ("أفضل موسيقى", "Best Music", "أفضل موسيقى في لعبة صدرت في 2025", 4),
                    ("أفضل ناشر", "Best Publisher", "أفضل ناشر ألعاب في 2025", 5),
                    ("أفضل مفاجأة", "Best Surprise", "أفضل مفاجأة (لعبة/إعلان/معرض) في 2025", 6),
                    ("أكبر خيبة أمل", "Biggest Disappointment", "أكبر خيبة أمل (لعبة/إعلان/معرض) في 2025", 7),
                    ("أكثر لعبة تتطلع لها في 2026", "Most Anticipated 2026", "أكثر لعبة تتطلع لها في 2026 (يلزم تواجد تأكيد رسمي)", 8),
                    ("أفضل ألعاب 2025", "Best Games 2025", "أفضل 5 ألعاب صدرت في 2025 بشكل عام", 9)
                ]
                
                for cat_ar, cat_en, desc, order in default_categories:
                    conn.execute("""
                        INSERT OR IGNORE INTO categories (name_ar, name_en, description, display_order) 
                        VALUES (?, ?, ?, ?)
                    """, (cat_ar, cat_en, desc, order))
        
        conn.commit()

# ✅ New Route: Get Publishers for Autocomplete
@app.route('/publishers')
def get_publishers():
    search = request.args.get('search', '').strip()
    limit = request.args.get('limit', 20)
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                if search:
                    cur.execute("""
                        SELECT name FROM publishers 
                        WHERE LOWER(name) LIKE LOWER(%s) 
                        ORDER BY name 
                        LIMIT %s
                    """, (f'%{search}%', limit))
                else:
                    cur.execute("SELECT name FROM publishers ORDER BY name LIMIT %s", (limit,))
                publishers = [r[0] for r in cur.fetchall()]
    else:
        # SQLite
        with get_conn() as conn:
            if search:
                cursor = conn.execute("""
                    SELECT name FROM publishers 
                    WHERE LOWER(name) LIKE LOWER(?) 
                    ORDER BY name 
                    LIMIT ?
                """, (f'%{search}%', limit))
            else:
                cursor = conn.execute("SELECT name FROM publishers ORDER BY name LIMIT ?", (limit,))
            publishers = [r[0] for r in cursor.fetchall()]
    
    return jsonify(publishers)

# ✅ Get suggestions based on category type
@app.route('/suggestions')
def get_suggestions():
    category_id = request.args.get('category_id', '')
    search = request.args.get('search', '').strip()
    limit = request.args.get('limit', 20)
    
    if not category_id:
        return jsonify([])
    
    # Determine if this is the "Best Publisher" category
    # Category ID 5 is "Best Publisher" based on default order
    is_publisher_category = (category_id == '5')
    
    if is_publisher_category:
        # Get publisher suggestions
        if DB_TYPE == 'postgres':
            with get_conn() as conn:
                with conn.cursor() as cur:
                    if search:
                        cur.execute("""
                            SELECT name FROM publishers 
                            WHERE LOWER(name) LIKE LOWER(%s) 
                            ORDER BY name 
                            LIMIT %s
                        """, (f'%{search}%', limit))
                    else:
                        cur.execute("SELECT name FROM publishers ORDER BY name LIMIT %s", (limit,))
                    suggestions = [r[0] for r in cur.fetchall()]
        else:
            # SQLite
            with get_conn() as conn:
                if search:
                    cursor = conn.execute("""
                        SELECT name FROM publishers 
                        WHERE LOWER(name) LIKE LOWER(?) 
                        ORDER BY name 
                        LIMIT ?
                    """, (f'%{search}%', limit))
                else:
                    cursor = conn.execute("SELECT name FROM publishers ORDER BY name LIMIT ?", (limit,))
                suggestions = [r[0] for r in cursor.fetchall()]
    else:
        # Get game suggestions for other categories
        if DB_TYPE == 'postgres':
            with get_conn() as conn:
                with conn.cursor() as cur:
                    if search:
                        cur.execute("""
                            SELECT name FROM games 
                            WHERE LOWER(name) LIKE LOWER(%s) 
                            ORDER BY name 
                            LIMIT %s
                        """, (f'%{search}%', limit))
                    else:
                        cur.execute("SELECT name FROM games ORDER BY name LIMIT %s", (limit,))
                    suggestions = [r[0] for r in cur.fetchall()]
        else:
            # SQLite
            with get_conn() as conn:
                if search:
                    cursor = conn.execute("""
                        SELECT name FROM games 
                        WHERE LOWER(name) LIKE LOWER(?) 
                        ORDER BY name 
                        LIMIT ?
                    """, (f'%{search}%', limit))
                else:
                    cursor = conn.execute("SELECT name FROM games ORDER BY name LIMIT ?", (limit,))
                suggestions = [r[0] for r in cursor.fetchall()]
    
    return jsonify(suggestions)


# ✅ Helpers
def sanitize_input(text):
    return re.sub(r'[;\'"\\&/*]', '', text).strip() if text else text

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
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Get user's votes with category names
                cur.execute("""
                    SELECT v.id, c.name_ar, v.category_id, v.rank, v.selection, v.points, v.timestamp
                    FROM votes v
                    JOIN categories c ON v.category_id = c.id
                    WHERE v.voter_name = %s
                    ORDER BY c.display_order, v.rank
                """, (username,))
                rows = cur.fetchall()
                
                # Count total voters
                cur.execute("SELECT COUNT(DISTINCT voter_name) FROM votes")
                total_voters = cur.fetchone()[0]
    else:
        # SQLite
        with get_conn() as conn:
            # Get user's votes with category names
            cursor = conn.execute("""
                SELECT v.id, c.name_ar, v.category_id, v.rank, v.selection, v.points, v.timestamp
                FROM votes v
                JOIN categories c ON v.category_id = c.id
                WHERE v.voter_name = ?
                ORDER BY c.display_order, v.rank
            """, (username,))
            rows = cursor.fetchall()
            
            # Count total voters
            cursor = conn.execute("SELECT COUNT(DISTINCT voter_name) FROM votes")
            total_voters = cursor.fetchone()[0]
    
    if not rows:
        return jsonify({
            'status': 'success',
            'username': username,
            'user_id': None,
            'votes_by_category': {},
            'total_voters': total_voters,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    
    # Organize votes by category
    votes_by_category = {}
    for row in rows:
        category_id = str(row[2])  # Convert to string for JSON key
        if category_id not in votes_by_category:
            votes_by_category[category_id] = {
                'category_name': row[1],
                'selections': []
            }
        votes_by_category[category_id]['selections'].append({
            'rank': row[3],
            'selection': row[4],
            'points': row[5]
        })
    
    return jsonify({
        'status': 'success',
        'username': username,
        'user_id': rows[0][0],
        'votes_by_category': votes_by_category,
        'total_voters': total_voters,
        'timestamp': rows[0][6]
    })

@app.route('/categories')
def get_categories():
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name_ar, name_en, description FROM categories ORDER BY display_order")
                categories = [{
                    "id": r[0],
                    "name_ar": r[1],
                    "name_en": r[2],
                    "description": r[3]
                } for r in cur.fetchall()]
    else:
        # SQLite
        with get_conn() as conn:
            cursor = conn.execute("SELECT id, name_ar, name_en, description FROM categories ORDER BY display_order")
            rows = cursor.fetchall()
            categories = [{
                "id": r[0],
                "name_ar": r[1],
                "name_en": r[2],
                "description": r[3]
            } for r in rows]
    return jsonify(categories)

# ✅ New Route: Get Games for Autocomplete
@app.route('/games')
def get_games():
    search = request.args.get('search', '').strip()
    limit = request.args.get('limit', 20)
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                if search:
                    cur.execute("""
                        SELECT name FROM games 
                        WHERE LOWER(name) LIKE LOWER(%s) 
                        ORDER BY name 
                        LIMIT %s
                    """, (f'%{search}%', limit))
                else:
                    cur.execute("SELECT name FROM games ORDER BY name LIMIT %s", (limit,))
                games = [r[0] for r in cur.fetchall()]
    else:
        # SQLite
        with get_conn() as conn:
            if search:
                cursor = conn.execute("""
                    SELECT name FROM games 
                    WHERE LOWER(name) LIKE LOWER(?) 
                    ORDER BY name 
                    LIMIT ?
                """, (f'%{search}%', limit))
            else:
                cursor = conn.execute("SELECT name FROM games ORDER BY name LIMIT ?", (limit,))
            games = [r[0] for r in cursor.fetchall()]
    
    return jsonify(games)


@app.route('/check-vote', methods=['POST'])
def check_vote():
    name = sanitize_input(request.get_json().get('name', ''))
    print(f"Checking vote for: {name}")  # Debug log
    
    if not name:
        return jsonify({'status': 'error', 'message': 'Name is required'}), 400
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM votes WHERE voter_name=%s", (name,))
                vote_count = cur.fetchone()[0]
                print(f"Vote count for {name}: {vote_count}")  # Debug log
                
                if vote_count > 0:
                    cur.execute("""
                        SELECT c.name_ar, v.rank, v.selection, v.points 
                        FROM votes v
                        JOIN categories c ON v.category_id = c.id
                        WHERE v.voter_name=%s 
                        ORDER BY c.display_order, v.rank
                    """, (name,))
                    votes = cur.fetchall()
                    return jsonify({
                        'status': 'exists',
                        'vote_count': vote_count,
                        'votes': [{
                            'category': v[0], 
                            'rank': v[1], 
                            'selection': v[2], 
                            'points': v[3]
                        } for v in votes]
                    })
                else:
                    return jsonify({'status': 'new'})


@app.route('/submit', methods=['POST'])
def submit_vote():
    data = request.get_json()
    name = sanitize_input(data.get('name', ''))
    votes_by_category = data.get('votes', {})  # Changed structure: {category_id: [selections]}
    
    if not name:
        return jsonify({'status': 'error', 'message': 'Name is required'}), 400
    
    # Validate votes structure
    if not isinstance(votes_by_category, dict):
        return jsonify({'status': 'error', 'message': 'Invalid votes format'}), 400
    
    try:
        with get_conn() as conn:
            if DB_TYPE == 'postgres':
                with conn.cursor() as cur:
                    # Check if user already voted
                    cur.execute("SELECT 1 FROM votes WHERE voter_name=%s LIMIT 1", (name,))
                    if cur.fetchone():
                        return jsonify({'status': 'error', 'message': 'You have already voted'}), 403
                    
                    # Process votes for each category
                    for category_id, selections in votes_by_category.items():
                        # Check if this is "Best Games 2025" category (category_id = 9)
                        if str(category_id) == '9':
                            # Best Games category requires exactly 5 selections
                            if not isinstance(selections, list) or len(selections) != 5:
                                return jsonify({'status': 'error', 'message': f'فئة "أفضل ألعاب 2025" تحتاج لاختيار 5 ألعاب مرتبة'}), 400
                            
                            # Insert votes for Best Games category with rankings
                            for rank, selection in enumerate(selections, start=1):
                                selection = sanitize_input(selection)
                                if not selection:
                                    return jsonify({'status': 'error', 'message': f'اللعبة في المركز {rank} لا يمكن أن تكون فارغة'}), 400
                                
                                points = POINT_SYSTEM.get(rank, 0)
                                cur.execute("""
                                    INSERT INTO votes (voter_name, category_id, rank, selection, points)
                                    VALUES (%s, %s, %s, %s, %s)
                                """, (name, int(category_id), rank, selection, points))
                        else:
                            # Other categories require exactly 1 selection
                            if not isinstance(selections, list) or len(selections) != 1:
                                return jsonify({'status': 'error', 'message': f'الفئة {category_id} تحتاج لاختيار واحد فقط'}), 400
                            
                            # Insert vote for other categories with rank 1 (default)
                            selection = sanitize_input(selections[0])
                            if not selection:
                                return jsonify({'status': 'error', 'message': f'الاختيار في الفئة {category_id} لا يمكن أن يكون فارغاً'}), 400
                            
                            # For single selection categories, use rank 1 and points 5
                            cur.execute("""
                                INSERT INTO votes (voter_name, category_id, rank, selection, points)
                                VALUES (%s, %s, 1, %s, 5)
                            """, (name, int(category_id), selection))
            else:
                # SQLite
                # Check if user already voted
                cursor = conn.execute("SELECT 1 FROM votes WHERE voter_name=? LIMIT 1", (name,))
                if cursor.fetchone():
                    return jsonify({'status': 'error', 'message': 'You have already voted'}), 403
                
                # Process votes for each category
                for category_id, selections in votes_by_category.items():
                    # Check if this is "Best Games 2025" category (category_id = 9)
                    if str(category_id) == '9':
                        # Best Games category requires exactly 5 selections
                        if not isinstance(selections, list) or len(selections) != 5:
                            return jsonify({'status': 'error', 'message': f'فئة "أفضل ألعاب 2025" تحتاج لاختيار 5 ألعاب مرتبة'}), 400
                        
                        # Insert votes for Best Games category with rankings
                        for rank, selection in enumerate(selections, start=1):
                            selection = sanitize_input(selection)
                            if not selection:
                                return jsonify({'status': 'error', 'message': f'اللعبة في المركز {rank} لا يمكن أن تكون فارغة'}), 400
                            
                            points = POINT_SYSTEM.get(rank, 0)
                            conn.execute("""
                                INSERT INTO votes (voter_name, category_id, rank, selection, points)
                                VALUES (?, ?, ?, ?, ?)
                            """, (name, int(category_id), rank, selection, points))
                    else:
                        # Other categories require exactly 1 selection
                        if not isinstance(selections, list) or len(selections) != 1:
                            return jsonify({'status': 'error', 'message': f'الفئة {category_id} تحتاج لاختيار واحد فقط'}), 400
                        
                        # Insert vote for other categories with rank 1 (default)
                        selection = sanitize_input(selections[0])
                        if not selection:
                            return jsonify({'status': 'error', 'message': f'الاختيار في الفئة {category_id} لا يمكن أن يكون فارغاً'}), 400
                        
                        # For single selection categories, use rank 1 and points 5
                        conn.execute("""
                            INSERT INTO votes (voter_name, category_id, rank, selection, points)
                            VALUES (?, ?, 1, ?, 5)
                        """, (name, int(category_id), selection))
            
            conn.commit()
            
    except Exception as e:
        print(f"Error submitting vote: {e}")
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

# ✅ Admin Publisher Management
@app.route('/admin/publisher', methods=['POST'])
def add_publisher():
    if not session.get('is_admin'): 
        return abort(403)
    
    data = request.get_json()
    name = sanitize_input(data.get('name', ''))
    
    if not name: 
        return jsonify({"status": "error", "message": "Publisher name required"}), 400
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO publishers (name) 
                    VALUES (%s)
                    ON CONFLICT DO NOTHING
                """, (name,))
                conn.commit()
                cur.execute("SELECT id FROM publishers WHERE name=%s", (name,))
                return jsonify({"status": "success" if cur.fetchone() else "error"})
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO publishers (name) 
                VALUES (?)
            """, (name,))
            conn.commit()
            cursor = conn.execute("SELECT id FROM publishers WHERE name=?", (name,))
            return jsonify({"status": "success" if cursor.fetchone() else "error"})

@app.route('/admin/publisher/<int:pid>', methods=['PUT'])
def edit_publisher(pid):
    if not session.get('is_admin'): 
        return abort(403)
    
    data = request.get_json()
    new_name = sanitize_input(data.get('name', ''))
    
    if not new_name: 
        return jsonify({"status": "error", "message": "Publisher name required"}), 400
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE publishers 
                    SET name=%s 
                    WHERE id=%s
                """, (new_name, pid))
                conn.commit()
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("""
                UPDATE publishers 
                SET name=? 
                WHERE id=?
            """, (new_name, pid))
            conn.commit()
    
    return jsonify({"status": "success"})

@app.route('/admin/publisher/<int:pid>', methods=['DELETE'])
def delete_publisher(pid):
    if not session.get('is_admin'): 
        return abort(403)
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM publishers WHERE id=%s", (pid,))
                conn.commit()
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("DELETE FROM publishers WHERE id=?", (pid,))
            conn.commit()
    
    return jsonify({"status": "success"})



# ✅ Admin View Table - Add games and publishers to the route
# ✅ Admin View Table - Updated to show category names for votes table
@app.route('/admin/view-table')
def view_table():
    if not session.get('is_admin'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    table = request.args.get('table', 'categories')
    page = int(request.args.get('page', 1))
    search = request.args.get('search', '').strip()
    limit, offset = 50, (page - 1) * 50

    # ✅ Updated to include games and publishers
    if table not in ["categories", "votes", "games", "publishers"]:
        return jsonify({"status": "error", "message": "Invalid table"}), 400
    
    # Special handling for votes table to include category name
    if table == "votes":
        if DB_TYPE == 'postgres':
            base_query = """
                SELECT 
                    v.id,
                    v.voter_name,
                    c.name_ar as category_name,
                    v.rank,
                    v.selection,
                    v.points,
                    v.timestamp
                FROM votes v
                JOIN categories c ON v.category_id = c.id
            """
            count_query = "SELECT COUNT(*) FROM votes v JOIN categories c ON v.category_id = c.id"
        else:
            base_query = """
                SELECT 
                    v.id,
                    v.voter_name,
                    c.name_ar as category_name,
                    v.rank,
                    v.selection,
                    v.points,
                    v.timestamp
                FROM votes v
                JOIN categories c ON v.category_id = c.id
            """
            count_query = "SELECT COUNT(*) FROM votes v JOIN categories c ON v.category_id = c.id"
    else:
        base_query = f"SELECT * FROM {table}"
        count_query = f"SELECT COUNT(*) FROM {table}"
    
    where, params = "", []
    if search:
        if table == "votes":
            # Search in votes table with joined category name
            where = "WHERE v.voter_name LIKE ? OR c.name_ar LIKE ? OR v.selection LIKE ?"
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
        elif table == "categories":
            where = "WHERE name_ar LIKE ? OR name_en LIKE ?"
            params.extend([f"%{search}%", f"%{search}%"])
        elif table == "games" or table == "publishers":
            where = "WHERE name LIKE ?"
            params.append(f"%{search}%")

    if DB_TYPE == 'postgres':
        if where:
            full_count_query = f"{count_query} {where}"
            full_data_query = f"{base_query} {where} ORDER BY v.id ASC LIMIT %s OFFSET %s" if table == "votes" else f"{base_query} {where} ORDER BY id ASC LIMIT %s OFFSET %s"
        else:
            full_count_query = count_query
            full_data_query = f"{base_query} ORDER BY v.id ASC LIMIT %s OFFSET %s" if table == "votes" else f"{base_query} ORDER BY id ASC LIMIT %s OFFSET %s"
        
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Get total count
                cur.execute(full_count_query, params)
                total_rows = cur.fetchone()[0]
                
                # Get data with pagination
                data_params = params + [limit, offset]
                cur.execute(full_data_query, data_params)
                rows = cur.fetchall()
                col_names = [desc[0] for desc in cur.description]
    else:
        # SQLite
        if where:
            full_count_query = f"{count_query} {where}"
            full_data_query = f"{base_query} {where} ORDER BY v.id ASC LIMIT ? OFFSET ?" if table == "votes" else f"{base_query} {where} ORDER BY id ASC LIMIT ? OFFSET ?"
        else:
            full_count_query = count_query
            full_data_query = f"{base_query} ORDER BY v.id ASC LIMIT ? OFFSET ?" if table == "votes" else f"{base_query} ORDER BY id ASC LIMIT ? OFFSET ?"
        
        with get_conn() as conn:
            # Get total count
            cursor = conn.execute(full_count_query, params)
            total_rows = cursor.fetchone()[0]
            
            # Get data with pagination
            data_params = params + [limit, offset]
            cursor = conn.execute(full_data_query, data_params)
            
            # Convert sqlite3.Row objects to regular Python lists
            rows = []
            for row in cursor.fetchall():
                rows.append(list(row))
            
            col_names = [description[0] for description in cursor.description]

    return jsonify({
        "status": "success",
        "table": table,
        "columns": col_names,
        "rows": rows,
        "total_rows": total_rows,
        "page": page,
        "pages": (total_rows + limit - 1) // limit,
        "has_pagination": total_rows > limit
    })


# ✅ Admin Game Management Routes (if not already added)
@app.route('/admin/game', methods=['POST'])
def add_game():
    if not session.get('is_admin'): 
        return abort(403)
    
    data = request.get_json()
    name = sanitize_input(data.get('name', ''))
    
    if not name: 
        return jsonify({"status": "error", "message": "Game name required"}), 400
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO games (name) 
                    VALUES (%s)
                    ON CONFLICT DO NOTHING
                """, (name,))
                conn.commit()
                cur.execute("SELECT id FROM games WHERE name=%s", (name,))
                return jsonify({"status": "success" if cur.fetchone() else "error"})
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO games (name) 
                VALUES (?)
            """, (name,))
            conn.commit()
            cursor = conn.execute("SELECT id FROM games WHERE name=?", (name,))
            return jsonify({"status": "success" if cursor.fetchone() else "error"})

@app.route('/admin/game/<int:gid>', methods=['PUT'])
def edit_game(gid):
    if not session.get('is_admin'): 
        return abort(403)
    
    data = request.get_json()
    new_name = sanitize_input(data.get('name', ''))
    
    if not new_name: 
        return jsonify({"status": "error", "message": "Game name required"}), 400
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE games 
                    SET name=%s 
                    WHERE id=%s
                """, (new_name, gid))
                conn.commit()
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("""
                UPDATE games 
                SET name=? 
                WHERE id=?
            """, (new_name, gid))
            conn.commit()
    
    return jsonify({"status": "success"})

@app.route('/admin/game/<int:gid>', methods=['DELETE'])
def delete_game(gid):
    if not session.get('is_admin'): 
        return abort(403)
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM games WHERE id=%s", (gid,))
                conn.commit()
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("DELETE FROM games WHERE id=?", (gid,))
            conn.commit()
    
    return jsonify({"status": "success"})



@app.route('/admin/vote/<int:vid>', methods=['PUT'])
def edit_vote(vid):
    if not session.get('is_admin'):
        return abort(403)

    data = request.get_json()
    new_selection = sanitize_input(data.get('selection', ''))
    new_rank = data.get('rank')
    
    if not new_selection or not new_rank:
        return jsonify({"status": "error", "message": "Selection and rank required"}), 400
    
    # Validate rank is between 1-5
    if new_rank < 1 or new_rank > 5:
        return jsonify({"status": "error", "message": "Rank must be between 1 and 5"}), 400
    
    new_points = POINT_SYSTEM.get(new_rank, 0)

    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE votes SET selection=%s, rank=%s, points=%s
                    WHERE id=%s
                """, (new_selection, new_rank, new_points, vid))
                conn.commit()
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("""
                UPDATE votes SET selection=?, rank=?, points=?
                WHERE id=?
            """, (new_selection, new_rank, new_points, vid))
            conn.commit()

    return jsonify({"status": "success"})

# ✅ Admin Modify Categories
@app.route('/admin/category', methods=['POST'])
def add_category():
    if not session.get('is_admin'): 
        return abort(403)
    
    data = request.get_json()
    name_ar = sanitize_input(data.get('name_ar', ''))
    name_en = sanitize_input(data.get('name_en', ''))
    
    if not name_ar or not name_en: 
        return jsonify({"status": "error", "message": "Arabic and English names required"}), 400
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO categories (name_ar, name_en, display_order) 
                    VALUES (%s, %s, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM categories))
                    ON CONFLICT DO NOTHING
                """, (name_ar, name_en))
                conn.commit()
                cur.execute("SELECT id FROM categories WHERE name_ar=%s", (name_ar,))
                return jsonify({"status": "success" if cur.fetchone() else "error"})
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO categories (name_ar, name_en, display_order) 
                VALUES (?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM categories))
            """, (name_ar, name_en))
            conn.commit()
            cursor = conn.execute("SELECT id FROM categories WHERE name_ar=?", (name_ar,))
            return jsonify({"status": "success" if cursor.fetchone() else "error"})

@app.route('/admin/category/<int:cid>', methods=['PUT'])
def edit_category(cid):
    if not session.get('is_admin'): 
        return abort(403)
    
    data = request.get_json()
    new_name_ar = sanitize_input(data.get('name_ar', ''))
    new_name_en = sanitize_input(data.get('name_en', ''))
    
    if not new_name_ar or not new_name_en: 
        return jsonify({"status": "error", "message": "Arabic and English names required"}), 400
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE categories 
                    SET name_ar=%s, name_en=%s 
                    WHERE id=%s
                """, (new_name_ar, new_name_en, cid))
                conn.commit()
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("""
                UPDATE categories 
                SET name_ar=?, name_en=? 
                WHERE id=?
            """, (new_name_ar, new_name_en, cid))
            conn.commit()
    
    return jsonify({"status": "success"})

@app.route('/admin/category/<int:cid>', methods=['DELETE'])
def delete_category(cid):
    if not session.get('is_admin'): 
        return abort(403)
    
    # Check if category has votes before deleting
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM votes WHERE category_id=%s LIMIT 1", (cid,))
                if cur.fetchone():
                    return jsonify({"status": "error", "message": "Cannot delete category with existing votes"}), 400
                
                cur.execute("DELETE FROM categories WHERE id=%s", (cid,))
                conn.commit()
    else:
        # SQLite
        with get_conn() as conn:
            cursor = conn.execute("SELECT 1 FROM votes WHERE category_id=? LIMIT 1", (cid,))
            if cursor.fetchone():
                return jsonify({"status": "error", "message": "Cannot delete category with existing votes"}), 400
            
            conn.execute("DELETE FROM categories WHERE id=?", (cid,))
            conn.commit()
    
    return jsonify({"status": "success"})

@app.route('/admin/vote/<int:vid>', methods=['DELETE'])
def delete_vote(vid):
    if not session.get('is_admin'): 
        return abort(403)
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM votes WHERE id=%s", (vid,))
                conn.commit()
    else:
        # SQLite
        with get_conn() as conn:
            conn.execute("DELETE FROM votes WHERE id=?", (vid,))
            conn.commit()
    
    return jsonify({"status": "success"})

@app.route('/check-name', methods=['POST'])
def check_name():
    name = request.get_json().get('name', '').strip()
    if name == ADMIN_USERNAME:
        return jsonify(status='admin')
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM votes WHERE voter_name=%s LIMIT 1", (name,))
                return jsonify(status='exists' if cur.fetchone() else 'new')
    else:
        # SQLite
        with get_conn() as conn:
            cursor = conn.execute("SELECT 1 FROM votes WHERE voter_name=? LIMIT 1", (name,))
            return jsonify(status='exists' if cursor.fetchone() else 'new')

# ✅ Excel Export (updated for new structure)
@app.route('/download-excel')
def download_excel():
    if not session.get('is_admin'):
        return abort(403)

    output = BytesIO()
    
    if DB_TYPE == 'postgres':
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Category rankings
                cur.execute("""
                    SELECT 
                        c.name_ar as category,
                        v.selection,
                        SUM(v.points) as total_points,
                        COUNT(DISTINCT v.voter_name) as voter_count,
                        ROUND(AVG(v.rank), 2) as avg_rank
                    FROM votes v
                    JOIN categories c ON v.category_id = c.id
                    GROUP BY c.id, v.selection
                    ORDER BY c.display_order, total_points DESC
                """)
                rankings_data = cur.fetchall()
                rankings_columns = [desc[0] for desc in cur.description]

                # All votes with category names
                cur.execute("""
                    SELECT 
                        v.voter_name,
                        c.name_ar as category,
                        v.rank,
                        v.selection,
                        v.points,
                        v.timestamp
                    FROM votes v
                    JOIN categories c ON v.category_id = c.id
                    ORDER BY v.timestamp DESC, c.display_order, v.rank
                """)
                votes_data = cur.fetchall()
                votes_columns = [desc[0] for desc in cur.description]
                
                # Games list
                cur.execute("SELECT name, created_at FROM games ORDER BY name")
                games_data = cur.fetchall()
                games_columns = [desc[0] for desc in cur.description]
                
                # Publishers list
                cur.execute("SELECT name, created_at FROM publishers ORDER BY name")
                publishers_data = cur.fetchall()
                publishers_columns = [desc[0] for desc in cur.description]
                
                # Get summary data
                cur.execute("SELECT COUNT(DISTINCT voter_name) FROM votes")
                total_voters = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM categories")
                total_categories = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM games")
                total_games = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM publishers")
                total_publishers = cur.fetchone()[0]
    else:
        # SQLite
        with get_conn() as conn:
            # Category rankings
            cursor = conn.execute("""
                SELECT 
                    c.name_ar as category,
                    v.selection,
                    SUM(v.points) as total_points,
                    COUNT(DISTINCT v.voter_name) as voter_count,
                    ROUND(AVG(v.rank), 2) as avg_rank
                FROM votes v
                JOIN categories c ON v.category_id = c.id
                GROUP BY c.id, v.selection
                ORDER BY c.display_order, total_points DESC
            """)
            rankings_data = cursor.fetchall()
            rankings_columns = [description[0] for description in cursor.description]

            # All votes with category names
            cursor = conn.execute("""
                SELECT 
                    v.voter_name,
                    c.name_ar as category,
                    v.rank,
                    v.selection,
                    v.points,
                    v.timestamp
                FROM votes v
                JOIN categories c ON v.category_id = c.id
                ORDER BY v.timestamp DESC, c.display_order, v.rank
            """)
            votes_data = cursor.fetchall()
            votes_columns = [description[0] for description in cursor.description]
            
            # Games list
            cursor = conn.execute("SELECT name, created_at FROM games ORDER BY name")
            games_data = cursor.fetchall()
            games_columns = [description[0] for description in cursor.description]
            
            # Publishers list
            cursor = conn.execute("SELECT name, created_at FROM publishers ORDER BY name")
            publishers_data = cursor.fetchall()
            publishers_columns = [description[0] for description in cursor.description]
            
            # Get summary data
            cursor = conn.execute("SELECT COUNT(DISTINCT voter_name) FROM votes")
            total_voters = cursor.fetchone()[0]
            
            cursor = conn.execute("SELECT COUNT(*) FROM categories")
            total_categories = cursor.fetchone()[0]
            
            cursor = conn.execute("SELECT COUNT(*) FROM games")
            total_games = cursor.fetchone()[0]
            
            cursor = conn.execute("SELECT COUNT(*) FROM publishers")
            total_publishers = cursor.fetchone()[0]

    # ✅ Convert query results to DataFrames
    rankings_df = pd.DataFrame(rankings_data, columns=rankings_columns)
    votes_df = pd.DataFrame(votes_data, columns=votes_columns)
    games_df = pd.DataFrame(games_data, columns=games_columns)
    publishers_df = pd.DataFrame(publishers_data, columns=publishers_columns)
    
    # Create summary DataFrame
    summary_df = pd.DataFrame({
        'Metric': ['Total Voters', 'Total Categories', 'Total Games', 'Total Publishers', 'Total Votes', 'System'],
        'Value': [total_voters, total_categories, total_games, total_publishers, total_voters * 45, 'Mixed System (5,4,3,2,1 for Best Games, 5 for others)']
    })

    # ✅ Write to Excel
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        rankings_df.to_excel(writer, sheet_name='Category Rankings', index=False)
        votes_df.to_excel(writer, sheet_name='All Votes', index=False)
        games_df.to_excel(writer, sheet_name='Games List', index=False)
        publishers_df.to_excel(writer, sheet_name='Publishers List', index=False)
        summary_df.to_excel(writer, sheet_name='Summary', index=False)

    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="tg_awards_2025.xlsx",
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

# ✅ Start App
if __name__ == '__main__':
    print("🔄 Initializing database...")
    init_db()
    warmup_db()
    print("✅ Ready. Server running...")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)