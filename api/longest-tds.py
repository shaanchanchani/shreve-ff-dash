from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import nfl_data_py as nfl
import pandas as pd
import os
import re
from dotenv import load_dotenv
from espn_api.football import League
from functools import lru_cache
import time

# Load environment variables from .env
load_dotenv()

NFL_YEAR = int(os.getenv('NFL_YEAR', '2025'))

# Cache for results - expires after 1 hour
_cache = {}
_cache_timestamp = 0
CACHE_DURATION = 3600  # 1 hour in seconds

def clear_cache():
    """Clear the cache to force fresh data fetch"""
    global _cache, _cache_timestamp
    _cache = {}
    _cache_timestamp = 0

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_nfl_data(year):
    try:
        df = nfl.import_pbp_data([year])
        # Filter to only needed columns and rows - include player IDs
        df = df[['passer_player_name', 'receiver_player_name', 'rusher_player_name', 
                'passer_player_id', 'receiver_player_id', 'rusher_player_id',
                'yards_gained', 'rush_touchdown', 'pass_touchdown', 'week']]
        # Clean up the data
        df = df.dropna(subset=['week'])
        df['week'] = df['week'].astype(int)
        return df
    except Exception as e:
        print(f"Error loading NFL data: {e}")
        raise e

@lru_cache(maxsize=1)
def get_credentials():
    espn_s2 = os.getenv('espn_s2')
    swid = os.getenv('SWID')
    league_id = int(os.getenv('LEAGUE_ID', '1918224288'))
    print(f"Loaded credentials: espn_s2={espn_s2[:20] if espn_s2 else None}..., SWID={swid[:20] if swid else None}...")
    return league_id, espn_s2, swid

def _name_key(name: str):
    """Return (first_initial, last_name) tuple stripped of punctuation for fuzzy matching."""
    if not name:
        return None, None
    cleaned = re.sub(r"[^A-Za-z\s]", " ", name)
    parts = [p for p in cleaned.split() if p]
    if not parts:
        return None, None
    first_initial = parts[0][0].lower()
    last_name = parts[-1].lower()
    return first_initial, last_name

def _player_id_value(value):
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    try:
        return str(value).strip()
    except Exception:
        return None

def _player_in_lineup(lineup, target_id, target_name_key):
    for lineup_player in lineup:
        lineup_id = getattr(lineup_player, 'playerId', None)
        if lineup_id is not None and target_id is not None and str(lineup_id) == target_id:
            return True
        if target_name_key and target_name_key[1]:
            lineup_key = _name_key(getattr(lineup_player, 'name', ''))
            if lineup_key[1] and lineup_key[1] == target_name_key[1]:
                # Require first initial match when available to avoid false positives
                if not target_name_key[0] or not lineup_key[0] or target_name_key[0] == lineup_key[0]:
                    return True
    return False

def check_fantasy_ownership(player_name, week, player_id=None):
    """Return fantasy team name if the player was started that week."""
    try:
        league_id, espn_s2, swid = get_credentials()
        
        if not espn_s2 or not swid:
            print(f"Missing credentials: espn_s2={bool(espn_s2)}, swid={bool(swid)}")
            return None
        
        # Create league instance  
        league = League(league_id=league_id, year=NFL_YEAR, espn_s2=espn_s2, swid=swid)
        
        # Get box scores for the week to see lineups
        try:
            box_scores = league.box_scores(week)
        except:
            print(f"No box scores available for week {week}")
            return None
        
        print(f"Checking {player_name} for week {week}")
        target_id = _player_id_value(player_id)
        target_name_key = _name_key(player_name)
        
        # Check each matchup's lineups - streamlit method
        for matchup in box_scores:
            # Check home team lineup
            if _player_in_lineup(matchup.home_lineup, target_id, target_name_key):
                return matchup.home_team.team_name
            
            # Check away team lineup  
            if _player_in_lineup(matchup.away_lineup, target_id, target_name_key):
                return matchup.away_team.team_name
        
        return None
        
    except Exception as e:
        print(f"Error checking fantasy ownership for {player_name} week {week}: {e}")
        return None

def find_longest_started_td(td_df, player_col, player_id_col=None):
    """Find the longest TD that was actually started, checking incrementally"""
    if td_df.empty:
        return None
    
    # Start with top 1, then expand if no hits  
    check_sizes = [1, 3, 5]
    
    for size in check_sizes:
        top_tds = td_df.nlargest(size, 'yards_gained')
        
        for _, row in top_tds.iterrows():
            player_id = _player_id_value(row[player_id_col]) if player_id_col else None
            fantasy_owner = check_fantasy_ownership(row[player_col], row['week'], player_id)
            if fantasy_owner:
                return {
                    'player': row[player_col],
                    'yards': int(row['yards_gained']),
                    'week': int(row['week']),
                    'fantasy_owner': fantasy_owner,
                    'player_id': player_id
                }
        
        print(f"No started players found in top {size} TDs, checking more...")
    
    print("No started players found in any checked TDs")
    return None

def get_top_tds_with_ownership(td_df, player_col, player_id_col=None, limit=3):
    """Get top TDs with fantasy ownership info"""
    if td_df.empty:
        return []
    
    top_tds = td_df.nlargest(limit, 'yards_gained')
    result = []
    
    for _, row in top_tds.iterrows():
        player_id = _player_id_value(row[player_id_col]) if player_id_col else None
        fantasy_owner = check_fantasy_ownership(row[player_col], row['week'], player_id)
        result.append({
            'player': row[player_col],
            'yards': int(row['yards_gained']),
            'week': int(row['week']),
            'fantasy_owner': fantasy_owner,
            'player_id': player_id
        })
    
    return result

def get_longest_tds(df):
    rushing_td_df = df[df['rush_touchdown'] == 1]
    rec_td_df = df[df['pass_touchdown'] == 1]
    pass_td_df = df[df['pass_touchdown'] == 1]
    
    result = {}
    
    # Get top 3 for each category (for display)
    if not rushing_td_df.empty:
        result['rushing_tds'] = get_top_tds_with_ownership(rushing_td_df, 'rusher_player_name', 'rusher_player_id', 3)
        longest_started = find_longest_started_td(rushing_td_df, 'rusher_player_name', 'rusher_player_id')
        if longest_started:
            result['longest_started_rushing_td'] = longest_started
    
    if not rec_td_df.empty:
        result['receiving_tds'] = get_top_tds_with_ownership(rec_td_df, 'receiver_player_name', 'receiver_player_id', 3)
        longest_started = find_longest_started_td(rec_td_df, 'receiver_player_name', 'receiver_player_id')
        if longest_started:
            result['longest_started_receiving_td'] = longest_started
    
    if not pass_td_df.empty:
        result['passing_tds'] = get_top_tds_with_ownership(pass_td_df, 'passer_player_name', 'passer_player_id', 3)
        longest_started = find_longest_started_td(pass_td_df, 'passer_player_name', 'passer_player_id')
        if longest_started:
            result['longest_started_passing_td'] = longest_started
    
    return result

@app.get("/")
async def get_longest_touchdowns_2025():
    global _cache, _cache_timestamp
    
    try:
        # Check cache first
        current_time = time.time()
        if _cache and (current_time - _cache_timestamp) < CACHE_DURATION:
            print("Returning cached result")
            return _cache
        
        print(f"{NFL_YEAR} done.")
        print("Downcasting floats.")
        
        # Use configured season
        df = load_nfl_data(NFL_YEAR)
        longest_tds = get_longest_tds(df)
        
        league_id, espn_s2, swid = get_credentials()
        
        # Add debug info
        longest_tds['debug_info'] = {
            'total_rushing_tds': len(df[df['rush_touchdown'] == 1]),
            'total_receiving_tds': len(df[df['pass_touchdown'] == 1]),
            'league_id': league_id,
            'has_espn_s2': bool(espn_s2),
            'has_swid': bool(swid),
            'year_used': NFL_YEAR,
            'cached_at': current_time
        }
        
        # Cache the result
        _cache = longest_tds
        _cache_timestamp = current_time
        
        return longest_tds
    except Exception as e:
        return {"error": str(e)}

@app.get("/clear-cache")
async def clear_cache_endpoint():
    """Endpoint to manually clear the cache"""
    clear_cache()
    return {"message": "Cache cleared"}

# Clear cache on startup to ensure fresh data with new structure
clear_cache()
