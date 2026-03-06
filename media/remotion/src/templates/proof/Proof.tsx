import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

interface StatItem { label: string; value: string; }

interface ProofProps {
    headline: string;
    stats: StatItem[];
    testimonial: string;
}

export const Proof: React.FC<ProofProps> = ({ headline, stats, testimonial }) => {
    const frame = useCurrentFrame();

    const headlineOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
    const statsOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' });
    const testimonialOpacity = interpolate(frame, [90, 120], [0, 1], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{ backgroundColor: '#0A0A0A', padding: 80, flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ color: '#FFFFFF', fontSize: 64, fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, opacity: headlineOpacity, margin: '0 0 48px' }}>
                {headline}
            </h1>
            <div style={{ display: 'flex', gap: 40, opacity: statsOpacity, marginBottom: 60 }}>
                {(stats || []).map((s, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{ color: '#C0C0C0', fontSize: 72, fontWeight: 700 }}>{s.value}</div>
                        <div style={{ color: '#888', fontSize: 28 }}>{s.label}</div>
                    </div>
                ))}
            </div>
            {testimonial && (
                <blockquote style={{ color: '#E0E0E0', fontSize: 36, fontFamily: 'Noto Sans JP, sans-serif', opacity: testimonialOpacity, borderLeft: '4px solid #C0C0C0', paddingLeft: 32, margin: 0 }}>
                    {testimonial}
                </blockquote>
            )}
        </AbsoluteFill>
    );
};
