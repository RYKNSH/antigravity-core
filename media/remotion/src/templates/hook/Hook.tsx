import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import React from 'react';

interface HookProps {
    eyebrow?: string;    // 上部の小さい煽り文
    title: string;       // メインキャッチ（改行\n対応）
    subtitle?: string;   // ブランド名など
    cta?: string;        // 下部CTA
}

export const Hook: React.FC<HookProps> = ({ eyebrow, title, subtitle, cta }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // ── アニメーション定義 ───────────────────────────────────
    const eyebrowOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
    const eyebrowY = interpolate(frame, [0, 10], [20, 0], { extrapolateRight: 'clamp' });

    const titleScale = spring({ frame: frame - 5, fps, from: 0.92, to: 1.0, config: { damping: 14, stiffness: 80 } });
    const titleOpacity = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: 'clamp' });

    const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp' });

    const ctaOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: 'clamp' });
    const ctaY = interpolate(frame, [55, 70], [16, 0], { extrapolateRight: 'clamp' });

    // アクセントライン（タイトル下）
    const lineWidth = interpolate(frame, [25, 50], [0, 120], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{
            backgroundColor: '#0A0A0A',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
        }}>
            {/* 上部グラデーションオーバーレイ */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: 400,
                background: 'linear-gradient(to bottom, rgba(192,192,192,0.04), transparent)',
                pointerEvents: 'none',
            }} />

            {/* メインコンテンツ */}
            <div style={{ textAlign: 'center', padding: '0 80px', width: '100%' }}>

                {/* Eyebrow（上部煽り文）*/}
                {eyebrow && (
                    <p style={{
                        color: '#C0C0C0',
                        fontSize: 36,
                        fontWeight: 400,
                        letterSpacing: '0.06em',
                        margin: '0 0 40px',
                        opacity: eyebrowOpacity,
                        transform: `translateY(${eyebrowY}px)`,
                    }}>
                        {eyebrow}
                    </p>
                )}

                {/* メインタイトル */}
                <h1 style={{
                    color: '#FFFFFF',
                    fontSize: 96,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    margin: 0,
                    whiteSpace: 'pre-line',
                    transform: `scale(${titleScale})`,
                    opacity: titleOpacity,
                    textShadow: '0 2px 40px rgba(192,192,192,0.15)',
                }}>
                    {title}
                </h1>

                {/* アクセントライン */}
                <div style={{
                    width: lineWidth,
                    height: 2,
                    backgroundColor: '#C0C0C0',
                    margin: '40px auto',
                    borderRadius: 1,
                }} />

                {/* ブランド / サブタイトル */}
                {subtitle && (
                    <p style={{
                        color: '#C0C0C0',
                        fontSize: 34,
                        fontWeight: 400,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        margin: 0,
                        opacity: subtitleOpacity,
                    }}>
                        {subtitle}
                    </p>
                )}
            </div>

            {/* CTA（下部） */}
            {cta && (
                <div style={{
                    position: 'absolute',
                    bottom: 180,
                    left: '50%',
                    transform: `translateX(-50%) translateY(${ctaY}px)`,
                    opacity: ctaOpacity,
                }}>
                    <div style={{
                        border: '1.5px solid #C0C0C0',
                        borderRadius: 4,
                        padding: '24px 56px',
                        color: '#FFFFFF',
                        fontSize: 34,
                        fontWeight: 500,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                    }}>
                        {cta}
                    </div>
                </div>
            )}

            {/* 下部グラデーション */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height: 300,
                background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                pointerEvents: 'none',
            }} />
        </AbsoluteFill>
    );
};
