import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

interface BarSegment {
    type: 'contact' | 'whiff' | 'noswing' | 'filler';
    count: number;
    widthClass: 'single' | 'group';
}

@Component({
    standalone: true,
    selector: 'app-pitcher-stats-bars',
    imports: [CommonModule],
    templateUrl: './pitcher-stats-bars.html',
    styleUrl: './pitcher-stats-bars.css'
})
export class PitcherStatsBars implements OnChanges {
    @Input() totalPitches: number = 0;
    @Input() swingRate: number = 0;
    @Input() contactRate: number = 0;

    segments: BarSegment[] = [];

    singleBarWidth: number = 3;
    tensBarWidth: number = 30;
    
    ngOnChanges(changes: SimpleChanges): void {
      if (this.totalPitches > 0) {
        this.calculateBars();
      } else {
        this.segments = []; // Clear bars if total is 0
      }
    }
    
    private calculateBars(): void {
        if (this.totalPitches === 0) return;

        // 1. Calculate the raw pitch counts for outcomes
        const swingCount = Math.round(this.totalPitches * this.swingRate);
        const contactCount = Math.round(swingCount * this.contactRate);
        const whiffCount = swingCount - contactCount;

        // Whiff + Contact = Swings. The noswing are balls or called strikes (no swing).
        const noSwingCount = this.totalPitches - swingCount;

        // 2. Determine the order and structure (Contact -> Whiff -> Noswing)
        const rawSegments = [
            { type: 'contact', count: contactCount },
            { type: 'whiff', count: whiffCount },
            { type: 'noswing', count: noSwingCount },
        ] as const;

        // 3. Convert raw counts into structured segments for rendering (group of 10s + singles)
        this.segments = [];

        for (const raw of rawSegments) {
            let count = raw.count;
            if (count < 0) count = 0;

            // Add 'group' bars (10s)
            const groupCount = Math.floor(count / 10);
            if (groupCount > 0) {
                this.segments.push({
                    type: raw.type,
                    count: groupCount,
                    widthClass: 'group'
                });
            }

            // Add 'single' bars (noswing < 10)
            const singleCount = count % 10;
            if (singleCount > 0) {
                // PUSH ONLY ONE OBJECT FOR THE ENTIRE REMAINDER
                this.segments.push({
                    type: raw.type,
                    count: singleCount, // This is the actual number of pitches (1-9)
                    widthClass: 'single' // Still use the 'single' class name for styling
                });
            }
        }
    }

    getBarClass(type: BarSegment['type']): string {
        switch (type) {
            case 'contact':
                return 'bar-contact';
            case 'whiff':
                return 'bar-whiff';
            case 'noswing':
                return 'bar-remaining';
            default:
                return '';
        }
    }
}