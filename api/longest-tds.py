from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import nfl_data_py as nfl
import pandas as pd
import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

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
        # Filter to only needed columns and rows
        df = df[['passer_player_name', 'receiver_player_name', 'rusher_player_name', 'yards_gained', 'rush_touchdown', 'pass_touchdown', 'week']]
        # Clean up the data
        df = df.dropna(subset=['week'])
        df['week'] = df['week'].astype(int)
        return df
    except Exception as e:
        print(f"Error loading NFL data: {e}")
        raise e

def get_espn_roster_for_week(week, league_id, espn_s2, swid):
    """Get ESPN fantasy rosters for a specific week"""
    try:
        url = f"https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/segments/0/leagues/{league_id}"
        params = {
            'scoringPeriodId': week,
            'view': ['mRoster', 'mTeam']
        }
        cookies = {
            'espn_s2': espn_s2,
            'SWID': swid
        }
        
        response = requests.get(url, params=params, cookies=cookies)
        print(f"ESPN API response for week {week}: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not dict'}")
            return data
        else:
            print(f"ESPN API error: {response.text[:200]}")
    except Exception as e:
        print(f"Error fetching ESPN data for week {week}: {e}")
    return None

def get_player_name_mapping():
    """Create mapping between NFL player names and ESPN player names"""
    # This would need to be expanded with actual player ID mappings
    # For now, we'll do basic string matching
    return {}

def get_credentials():
    return os.getenv('espn_s2'), os.getenv('SWID')

def check_fantasy_ownership(player_name, week):
    """Check if player was started in fantasy that week"""
    league_id = os.getenv('LEAGUE_ID', '1918224288')
    espn_s2, swid = get_credentials()
    
    if not espn_s2 or not swid:
        print(f"Missing credentials: espn_s2={bool(espn_s2)}, swid={bool(swid)}")
        return None
    
    roster_data = get_espn_roster_for_week(week, league_id, espn_s2, swid)
    if not roster_data:
        print(f"No roster data for week {week}")
        return None
    
    print(f"Checking {player_name} for week {week}")
    
    # Search through rosters for the player
    for team in roster_data.get('teams', []):
        team_name = team.get('name', team.get('location', f"Team {team.get('id', '')}"))
        for entry in team.get('roster', {}).get('entries', []):
            player = entry.get('playerPoolEntry', {}).get('player', {})
            full_name = player.get('fullName', '')
            lineup_slot = entry.get('lineupSlotId', 0)
            
            # Check if player names match (basic string comparison)
            if player_name.lower() in full_name.lower() or full_name.lower() in player_name.lower():
                print(f"Found {player_name} -> {full_name} on {team_name}, slot: {lineup_slot}")
                # lineupSlotId < 20 means they were in starting lineup (not bench)
                if lineup_slot < 20:
                    return team_name
    
    return None

def get_longest_tds(df):
    rushing_td_df = df[df['rush_touchdown'] == 1]
    rec_td_df = df[df['pass_touchdown'] == 1]
    pass_td_df = df[df['pass_touchdown'] == 1]
    
    result = {}
    
    # Get top 3 rushing TDs and find the longest one that was started
    if not rushing_td_df.empty:
        result['rushing_tds'] = []
        rushing_started_td = None
        
        for _, row in rushing_td_df.nlargest(10, 'yards_gained').iterrows():
            fantasy_owner = check_fantasy_ownership(row['rusher_player_name'], row['week'])
            td_data = {
                'player': row['rusher_player_name'],
                'yards': int(row['yards_gained']),
                'week': int(row['week']),
                'fantasy_owner': fantasy_owner
            }
            
            if len(result['rushing_tds']) < 3:
                result['rushing_tds'].append(td_data)
            
            # Track longest TD that was actually started
            if fantasy_owner and (not rushing_started_td or td_data['yards'] > rushing_started_td['yards']):
                rushing_started_td = td_data
        
        if rushing_started_td:
            result['longest_started_rushing_td'] = rushing_started_td
    
    # Get top 3 receiving TDs and find the longest one that was started
    if not rec_td_df.empty:
        result['receiving_tds'] = []
        receiving_started_td = None
        
        for _, row in rec_td_df.nlargest(10, 'yards_gained').iterrows():
            fantasy_owner = check_fantasy_ownership(row['receiver_player_name'], row['week'])
            td_data = {
                'player': row['receiver_player_name'],
                'yards': int(row['yards_gained']),
                'week': int(row['week']),
                'fantasy_owner': fantasy_owner
            }
            
            if len(result['receiving_tds']) < 3:
                result['receiving_tds'].append(td_data)
            
            # Track longest TD that was actually started
            if fantasy_owner and (not receiving_started_td or td_data['yards'] > receiving_started_td['yards']):
                receiving_started_td = td_data
        
        if receiving_started_td:
            result['longest_started_receiving_td'] = receiving_started_td
    
    # Get top 3 passing TDs and find the longest one that was started
    if not pass_td_df.empty:
        result['passing_tds'] = []
        passing_started_td = None
        
        for _, row in pass_td_df.nlargest(10, 'yards_gained').iterrows():
            fantasy_owner = check_fantasy_ownership(row['passer_player_name'], row['week'])
            td_data = {
                'player': row['passer_player_name'],
                'yards': int(row['yards_gained']),
                'week': int(row['week']),
                'fantasy_owner': fantasy_owner
            }
            
            if len(result['passing_tds']) < 3:
                result['passing_tds'].append(td_data)
            
            # Track longest TD that was actually started
            if fantasy_owner and (not passing_started_td or td_data['yards'] > passing_started_td['yards']):
                passing_started_td = td_data
        
        if passing_started_td:
            result['longest_started_passing_td'] = passing_started_td
    
    return result

@app.get("/")
async def get_longest_touchdowns_2025():
    try:
        # Use 2025 season
        df = load_nfl_data(2025)
        longest_tds = get_longest_tds(df)
        
        espn_s2, swid = get_credentials()
        
        # Add debug info
        longest_tds['debug_info'] = {
            'total_rushing_tds': len(df[df['rush_touchdown'] == 1]),
            'total_receiving_tds': len(df[df['pass_touchdown'] == 1]),
            'league_id': os.getenv('LEAGUE_ID', 'NOT_SET'),
            'has_espn_s2': bool(espn_s2),
            'has_swid': bool(swid),
            'year_used': 2025
        }
        
        return longest_tds
    except Exception as e:
        return {"error": str(e)}