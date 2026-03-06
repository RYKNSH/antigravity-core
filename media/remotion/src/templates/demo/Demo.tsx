import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

interface StepItem {
    number: string;
    label: string;
    description: string;
}

interface DemoProps {
    title: string;       // 見出し（\n改行対応）
    steps: StepItem[];   // 3ステップ推奨
    cta?: string;        // 下部CTA
}

export const Demo: React.FC<DemoProps> = ({ title, steps, cta }) => {
    const frame = useCurrentFrame();

    // 見出し
    const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
    const titleY = interpolate(frame, [0, 18], [24, 0], { extrapolateRight: 'clamp' });

    // アクセントライン
    const lineWidth = interpolate(frame, [18, 35], [0, 120], { extrapolateRight: 'clamp' });

    // CTA
    const ctaOpacity = interpolate(frame, [85, 100], [0, 1], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{
            backgroundColor: '#0A0A0A',
            justifyContent: 'center',
            alignItems: 'flex-start',
            fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
            padding: '0 72px',
        }}>
            <div style={{ width: '100%', paddingTop: 200 }}>
                {/* タイトル */}
                <h1 style={{
                    color: '#FFFFFF',
                    fontSize: 80,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    margin: '0 0 32px',
                    whiteSpace: 'pre-line',
                    opacity: titleOpacity,
                    transform: `translateY(${titleY}px)`,
                }}>
                    {title}
                </h1>

                {/* アクセントライン */}
                <div style={{
                    width: lineWidth,
                    height: 2,
                    backgroundColor: '#C0C0C0',
                    marginBottom: 80,
                    borderRadius: 1,
                }} />

                {/* ステップ一覧 */}
                {steps.map((step, i) => {
                    const stepOpacity = interpolate(frame, [28 + i * 18, 44 + i * 18], [0, 1], { extrapolateRight: 'clamp' });
                    const stepX = interpolate(frame, [28 + i * 18, 44 + i * 18], [-40, 0], { extrapolateRight: 'clamp' });
                    return (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            marginBottom: 60,
                            opacity: stepOpacity,
                            transform: `translateX(${stepX}px)`,
                        }}>
                            {/* 番号 */}
                            <div style={{
                                color: '#C0C0C0',
                                fontSize: 52,
                                fontWeight: 700,
                                lineHeight: 1,
                                minWidth: 100,
                                letterSpacing: '-0.02em',
                                paddingTop: 4,
                            }}>
                                {step.number}
                            </div>

                            {/* 縦区切り */}
                            <div style={{
                                width: 2,
                                background: 'linear-gradient(to bottom, #C0C0C0, rgba(192,192,192,0.2))',
                                borderRadius: 1,
                                margin: '0 36px',
                                alignSelf: 'stretch',
                                minHeight: 64,
                            }} />

                            {/* テキスト */}
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    color: '#FFFFFF',
                                    fontSize: 48,
                                    fontWeight: 700,
                                    lineHeight: 1.3,
                                    marginBottom: 12,
                                }}>
                                    {step.label}
                                </div>
                                <div style={{
                                    color: '#C0C0C0',
                                    fontSize: 34,
                                    fontWeight: 400,
                                    lineHeight: 1.5,
                                }}>
                                    {step.description}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* CTA */}
                {cta && (
                    <div style={{
                        marginTop: 40,
                        opacity: ctaOpacity,
                        display: 'inline-block',
                        border: '1.5px solid #C0C0C0',
                        borderRadius: 4,
                        padding: '24px 56px',
                    }}>
                        <span style={{
                            color: '#FFFFFF',
                            fontSize: 36,
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                        }}>
                            {cta}
                        </span>
                    </div>
                )}
            </div>
        </AbsoluteFill>
    );
};
