import { Composition } from 'remotion';
import React from 'react';
import { Hook } from './templates/hook/Hook';
import { Proof } from './templates/proof/Proof';
import { Demo } from './templates/demo/Demo';
import { OpEd } from './templates/op-ed/OpEd';

// SOLOPROブランド仕様 — final_report.md 確定値
// サイズ: 1080×1920（縦型SNS広告）
// カラー: 背景 #0A0A0A / テキスト #FFFFFF / アクセント #C0C0C0
// フォント: Noto Sans JP Bold（見出し）/ Regular（本文）

export const RemotionRoot: React.FC = () => {
      return (
            <>
                  {/* Hook型: 3〜5秒の強烈な問いかけ */}
                  <Composition
                        id="hook"
                        component={Hook as React.ComponentType}
                        durationInFrames={150}   // 5秒 @ 30fps
                        fps={30}
                        width={1080}
                        height={1920}
                        defaultProps={{
                              eyebrow: 'あなたの月収は、本当に限界ですか？',
                              title: '月30万の壁、\nAIで消した人がいる。',
                              subtitle: 'Singularity Project — Antigravity',
                              cta: '無料ウェビナーで詳細を見る',
                        }}
                  />

                  {/* Proof型: 実績・社会的証明 */}
                  <Composition
                        id="proof"
                        component={Proof as React.ComponentType}
                        durationInFrames={240}   // 8秒 @ 30fps
                        fps={30}
                        width={1080}
                        height={1920}
                        defaultProps={{
                              headline: '参加者の92%が\n初月から変化を報告',
                              stats: [
                                    { value: '92', unit: '%', label: '初月から変化あり' },
                                    { value: '3.2', unit: '倍', label: '平均スループット向上' },
                                    { value: '47', unit: '名', label: '2025年度実績' },
                              ],
                              testimonial: '"Antigravityに出会って3ヶ月で、\nプロジェクトの回転が別物になった"',
                              source: '— 参加者 T.S. 経営コンサルタント',
                        }}
                  />

                  {/* Demo型: ステップ・使い方説明 */}
                  <Composition
                        id="demo"
                        component={Demo as React.ComponentType}
                        durationInFrames={270}   // 9秒 @ 30fps
                        fps={30}
                        width={1080}
                        height={1920}
                        defaultProps={{
                              title: '3ステップで\n"杖"を手に入れる',
                              steps: [
                                    { number: '01', label: 'ウェビナー参加', description: '無料・90分・完全recorded' },
                                    { number: '02', label: 'AIオリエン動画視聴', description: '3日間で全体像を把握' },
                                    { number: '03', label: '面談 → 即戦力化', description: 'プロジェクトにAntigravityを導入' },
                              ],
                              cta: '次回ウェビナーを予約する',
                        }}
                  />

                  {/* OpEd型: 5秒ブランドアニメーション（OP/ED共用） */}
                  <Composition
                        id="op-ed"
                        component={OpEd as React.ComponentType}
                        durationInFrames={150}   // 5秒 @ 30fps
                        fps={30}
                        width={1080}
                        height={1920}
                        defaultProps={{
                              logoText: 'ANTIGRAVITY',
                              tagline: 'Power to the People',
                              role: 'op',   // 'op' | 'ed'
                        }}
                  />
            </>
      );
};
