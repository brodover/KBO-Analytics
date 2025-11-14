PITCH_RESULT_MAP = {
    'H': 'Hit',
    'S': 'Swing',
    'F': 'Foul',
    'T': 'Strike',
    'B': 'Ball',
    'V': 'Swing (Bunt)', # 헛스윙번트
    'W': 'Foul (Bunt)', # 번트파울
}

PITCH_TYPE_MAP = {
    '직구': 'Four Seam',
    '투심': 'Two Seam',
    '커터': 'Cutter',
    
    '슬라이더': 'Slider',
    '커브': 'Curve',
    '스위퍼': 'Sweeper',
    
    '포크': 'Fork',
    '체인지업': 'Change Up',
    
    '너클볼': 'Knuckle',
}



SWING_CODES = {'H', 'S', 'V', 'F', 'W'}
CONTACT_CODES = {'H', 'F', 'W'}