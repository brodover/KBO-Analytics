export interface Pitch {
  pitch_id?: number; 
  pitcher_name: string;
  pitch_type: string; // e.g., 'FF', 'CU', 'SL'
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