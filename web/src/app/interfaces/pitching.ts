export interface Pitch {
  pitch_id?: number; 
  pitcher_team_code: string;
  pitcher_name: string;
  pitch_type: string;
  is_throwing_stretch: boolean; // True for Stretch, False for Windup
  
  // Release point (ft)
  x0: number; // Release lateral offset
  z0: number; // Release vertical offset
  y0: number; // Release distance (usually ~50 ft)
  
  // Initial Velocity (ft/s)
  vx0: number; 
  vy0: number; // Velocity toward plate (negative value)
  vz0: number;
  
  // Acceleration (ft/s^2)
  ax: number;
  ay: number; // Acceleration (mostly air resistance/drag)
  az: number; // Vertical acceleration (gravity + spin)
}

export interface StrikeZoneData {
  entity_type: 'ALL' | 'TEAM' | 'BATTER';
  entity_name: string; // 'ALL', 'LG', '고승민', etc.
  avg_strikezone_top: number;
  avg_strikezone_btm: number;
}

export interface PitchTypeSummary {
  pitch_type: string;
  count: number;
  // Average Release Point
  avg_x0: number;
  avg_z0: number;
  // Average Projection Point at 150ms
  avg_proj_x_150ms: number;
  avg_proj_z_150ms: number;
}

export interface PitcherEffectiveness {
  pitcher_team_code: string;
  batter_team_code: string;
  pitcher_name: string;
  pitch_type: string;
  
  // Windup Metrics
  'pitches (windup)': number;
  'swing rate (windup)': number;
  'whiff rate (windup)': number;
  'contact rate (windup)': number;

  // Stretch Metrics
  'pitches (stretch)': number;
  'swing rate (stretch)': number;
  'whiff rate (stretch)': number;
  'contact rate (stretch)': number;
}

export interface TrajectoryPoint {
  t: number;           // Time in seconds from release
  x: number;           // Horizontal location (Batter POV)
  z: number;           // Vertical location (Batter POV)
  is_tunnel_end: boolean; // True if time >= 150ms remaining
}

export interface PitchTrajectory {
  pitcher_pitch_key: string; // e.g., "54755_직구"
  pitcher_id: number;
  pitcher_name: string;
  pitcher_team_code: string;
  pitch_type: string;
  count: number;
  avg_trajectory: TrajectoryPoint[];
}

export interface PitcherTeam {
  teamCode: string;
  pitchers: { id: number; name: string }[];
}