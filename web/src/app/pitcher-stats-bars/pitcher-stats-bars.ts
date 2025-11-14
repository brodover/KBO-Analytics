import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
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

    private readonly BASE_SINGLE_PITCH_WIDTH_PX = 3;
    private readonly PITCHES_AT_MAX_WIDTH = 100;
    private readonly MAX_PIXEL_WIDTH = 300;

    public scaledSingleBarWidth: number = this.BASE_SINGLE_PITCH_WIDTH_PX;
    public scaledTensBarWidth: number = this.BASE_SINGLE_PITCH_WIDTH_PX * 10;
    
    public isScaled: boolean = false; 
    
    ngOnChanges(changes: SimpleChanges): void {
      if (this.totalPitches > 0) {
        this.calculateScaling();
        this.calculateBars();
      } else {
        this.segments = []; 
        this.isScaled = false;
      }
    }
    
    private calculateScaling(): void {
        let scaleFactor = 1;

        if (this.totalPitches > this.PITCHES_AT_MAX_WIDTH) {
            // Example: 200 pitches -> scaleFactor = 100 / 200 = 0.5
            scaleFactor = this.PITCHES_AT_MAX_WIDTH / this.totalPitches;
            this.isScaled = true;
        } else {
            this.isScaled = false;
        }

        // Apply scale factor to the base widths
        this.scaledSingleBarWidth = this.BASE_SINGLE_PITCH_WIDTH_PX * scaleFactor;
        this.scaledTensBarWidth = (this.BASE_SINGLE_PITCH_WIDTH_PX * 10) * scaleFactor;
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
                this.segments.push({
                    type: raw.type,
                    count: singleCount,
                    widthClass: 'single'
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