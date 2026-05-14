from flask import Flask, render_template, jsonify, request
import pandas as pd
import os
import json
import re
from datetime import datetime
import random
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# YouTube links database file
YOUTUBE_DB_FILE = os.path.join(os.path.dirname(__file__), 'youtube_links.json')

# Cache untuk sentiment data
_sentiment_data_cache = {
    'data': None,
    'loaded': False
}

# Load data dengan error handling
def load_sentiment_data():
    global _sentiment_data_cache
    
    # Gunakan cache jika sudah loaded
    if _sentiment_data_cache['loaded'] and _sentiment_data_cache['data'] is not None:
        return _sentiment_data_cache['data']
    
    try:
        positive_file = os.path.join(os.path.dirname(__file__), 'positive.tsv')
        negative_file = os.path.join(os.path.dirname(__file__), 'negative.tsv')
        
        # Check file exists
        if not os.path.exists(positive_file):
            logger.error(f"File tidak ditemukan: {positive_file}")
            raise FileNotFoundError(f"positive.tsv tidak ditemukan")
        
        if not os.path.exists(negative_file):
            logger.error(f"File tidak ditemukan: {negative_file}")
            raise FileNotFoundError(f"negative.tsv tidak ditemukan")
        
        positive_df = pd.read_csv(positive_file, sep='\t')
        negative_df = pd.read_csv(negative_file, sep='\t')
        
        # Cache the data
        _sentiment_data_cache['data'] = (positive_df, negative_df)
        _sentiment_data_cache['loaded'] = True
        
        logger.info(f"Data berhasil diload - Positive: {len(positive_df)}, Negative: {len(negative_df)}")
        return positive_df, negative_df
        
    except Exception as e:
        logger.error(f"Error saat load data: {str(e)}")
        # Return empty dataframes if error
        empty_df = pd.DataFrame({'word': [], 'weight': []})
        return empty_df, empty_df

# Load YouTube database dengan error handling
def load_youtube_db():
    try:
        if os.path.exists(YOUTUBE_DB_FILE):
            with open(YOUTUBE_DB_FILE, 'r') as f:
                data = json.load(f)
                logger.info(f"YouTube DB loaded: {len(data)} entries")
                return data
        return []
    except Exception as e:
        logger.error(f"Error saat load YouTube DB: {str(e)}")
        return []

# Save YouTube database dengan error handling
def save_youtube_db(data):
    try:
        # Buat backup sebelum save
        if os.path.exists(YOUTUBE_DB_FILE):
            backup_file = YOUTUBE_DB_FILE + '.backup'
            try:
                with open(YOUTUBE_DB_FILE, 'r') as f:
                    backup_data = json.load(f)
                with open(backup_file, 'w') as f:
                    json.dump(backup_data, f, indent=2)
            except:
                pass
        
        with open(YOUTUBE_DB_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info(f"YouTube DB saved: {len(data)} entries")
    except Exception as e:
        logger.error(f"Error saat save YouTube DB: {str(e)}")

# Extract video ID from YouTube URL
def extract_youtube_id(url):
    # Pattern untuk berbagai format YouTube URL
    patterns = [
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

# Generate mock analysis dengan error handling
def generate_analysis(video_id):
    try:
        # Generate hasil analisis yang konsisten untuk video ID yang sama
        random.seed(int(video_id[:3], 36) % 10000)
        
        positive_count = random.randint(20, 150)
        negative_count = random.randint(10, 100)
        neutral_count = random.randint(30, 120)
        
        total = positive_count + negative_count + neutral_count
        
        # Load sentiment data untuk ambil sample words
        positive_df, negative_df = load_sentiment_data()
        
        # Check if data empty
        if len(positive_df) == 0 or len(negative_df) == 0:
            logger.warning("Data kosong atau tidak ditemukan")
            return {
                'positive': 50.0,
                'negative': 30.0,
                'neutral': 20.0,
                'positive_count': positive_count,
                'negative_count': negative_count,
                'neutral_count': neutral_count,
                'total_comments': total,
                'positive_words': [],
                'negative_words': [],
            }
        
        # Get random positive words
        positive_words = positive_df.sample(min(20, len(positive_df)), random_state=int(video_id[:3], 36) % 10000).to_dict('records')
        
        # Get random negative words  
        negative_words = negative_df.sample(min(20, len(negative_df)), random_state=int(video_id[:3], 36) % 10000).to_dict('records')
        
        # Shuffle to make it look more random
        random.shuffle(positive_words)
        random.shuffle(negative_words)
        
        return {
            'positive': round((positive_count / total) * 100, 2),
            'negative': round((negative_count / total) * 100, 2),
            'neutral': round((neutral_count / total) * 100, 2),
            'positive_count': positive_count,
            'negative_count': negative_count,
            'neutral_count': neutral_count,
            'total_comments': total,
            'positive_words': positive_words[:20],
            'negative_words': negative_words[:20],
        }
    except Exception as e:
        logger.error(f"Error dalam generate_analysis: {str(e)}")
        return {
            'positive': 50.0,
            'negative': 30.0,
            'neutral': 20.0,
            'positive_count': 50,
            'negative_count': 30,
            'neutral_count': 20,
            'total_comments': 100,
            'positive_words': [],
            'negative_words': [],
        }

@app.route('/')
def index():
    try:
        positive_df, negative_df = load_sentiment_data()
        
        stats = {
            'total_positive': len(positive_df),
            'total_negative': len(negative_df),
            'total_words': len(positive_df) + len(negative_df),
            'avg_positive_weight': float(positive_df['weight'].mean()) if len(positive_df) > 0 else 0,
            'avg_negative_weight': float(negative_df['weight'].mean()) if len(negative_df) > 0 else 0,
        }
        
        return render_template('index.html', stats=stats)
    except Exception as e:
        logger.error(f"Error di route /: {str(e)}")
        return render_template('index.html', stats={
            'total_positive': 0,
            'total_negative': 0,
            'total_words': 0,
            'avg_positive_weight': 0,
            'avg_negative_weight': 0,
            'error': 'Data tidak dapat dimuat'
        })

@app.route('/api/data')
def get_data():
    try:
        positive_df, negative_df = load_sentiment_data()
        
        if len(positive_df) == 0 or len(negative_df) == 0:
            return jsonify({
                'positive': [],
                'negative': [],
                'total_positive': 0,
                'total_negative': 0,
                'warning': 'Data tidak lengkap'
            }), 200
        
        positive_list = positive_df.sort_values('weight', ascending=False).head(20).to_dict('records')
        negative_list = negative_df.sort_values('weight', ascending=True).head(20).to_dict('records')
        
        return jsonify({
            'positive': positive_list,
            'negative': negative_list,
            'total_positive': len(positive_df),
            'total_negative': len(negative_df),
        })
    except Exception as e:
        logger.error(f"Error di /api/data: {str(e)}")
        return jsonify({'error': str(e), 'positive': [], 'negative': []}), 500

@app.route('/api/search')
def search():
    try:
        query = request.args.get('q', '').lower()
        positive_df, negative_df = load_sentiment_data()
        
        if len(positive_df) == 0 or len(negative_df) == 0:
            return jsonify({'positive': [], 'negative': []}), 200
        
        positive_results = positive_df[positive_df['word'].str.lower().str.contains(query)].to_dict('records')
        negative_results = negative_df[negative_df['word'].str.lower().str.contains(query)].to_dict('records')
        
        return jsonify({
            'positive': positive_results,
            'negative': negative_results,
        })
    except Exception as e:
        logger.error(f"Error di /api/search: {str(e)}")
        return jsonify({'error': str(e), 'positive': [], 'negative': []}), 500

# YouTube Analyzer Endpoints
@app.route('/api/youtube/add', methods=['POST'])
def add_youtube_link():
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL tidak boleh kosong'}), 400
        
        video_id = extract_youtube_id(url)
        if not video_id:
            return jsonify({'error': 'Format URL YouTube tidak valid'}), 400
        
        # Load existing links
        youtube_db = load_youtube_db()
        
        # Check if already exists
        existing = [item for item in youtube_db if item['video_id'] == video_id]
        if existing:
            return jsonify({'error': 'Link YouTube ini sudah dianalisis', 'data': existing[0]}), 200
        
        # Generate analysis
        analysis = generate_analysis(video_id)
        
        # Create new entry
        new_entry = {
            'video_id': video_id,
            'url': url,
            'title': f'Video {video_id[:5]}',  # Mock title
            'added_date': datetime.now().isoformat(),
            'analysis': analysis
        }
        
        youtube_db.append(new_entry)
        save_youtube_db(youtube_db)
        
        return jsonify({
            'success': True,
            'data': new_entry,
            'message': 'Link berhasil dianalisis'
        }), 201
    except Exception as e:
        logger.error(f"Error di /api/youtube/add: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/youtube/list')
def get_youtube_links():
    try:
        youtube_db = load_youtube_db()
        return jsonify(youtube_db), 200
    except Exception as e:
        logger.error(f"Error di /api/youtube/list: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/youtube/delete/<video_id>', methods=['DELETE'])
def delete_youtube_link(video_id):
    try:
        youtube_db = load_youtube_db()
        youtube_db = [item for item in youtube_db if item['video_id'] != video_id]
        save_youtube_db(youtube_db)
        
        return jsonify({'success': True, 'message': 'Link berhasil dihapus'}), 200
    except Exception as e:
        logger.error(f"Error di /api/youtube/delete: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/youtube/data/<video_id>')
def get_youtube_data(video_id):
    try:
        youtube_db = load_youtube_db()
        
        # Find the video
        video_data = None
        for item in youtube_db:
            if item['video_id'] == video_id:
                video_data = item
                break
        
        if not video_data:
            return jsonify({'error': 'Video not found'}), 404
        
        analysis = video_data['analysis']
        
        return jsonify({
            'total_positive': analysis['positive_count'],
            'total_negative': analysis['negative_count'],
            'total_words': analysis['total_comments'],
            'avg_positive_weight': round(analysis['positive'], 2),
            'avg_negative_weight': round(analysis['negative'], 2),
            'positive_words': analysis.get('positive_words', []),
            'negative_words': analysis.get('negative_words', []),
            'source': 'youtube',
            'video_id': video_id,
            'title': video_data['title'],
            'url': video_data['url'],
        }), 200
    except Exception as e:
        logger.error(f"Error di /api/youtube/data: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@app.route('/api/health')
def health_check():
    try:
        positive_df, negative_df = load_sentiment_data()
        return jsonify({
            'status': 'ok',
            'timestamp': datetime.now().isoformat(),
            'data_loaded': _sentiment_data_cache['loaded'],
            'positive_count': len(positive_df),
            'negative_count': len(negative_df)
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    # Pre-load data on startup
    logger.info("Memuat data saat startup...")
    load_sentiment_data()
    
    logger.info("Server dimulai di http://0.0.0.0:5000")
    app.run(debug=False, host='0.0.0.0', port=5000, use_reloader=False)
