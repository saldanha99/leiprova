"use client";

import { useState } from "react";

import { QuizBuilder } from "./quiz-builder";
import { QuizSession } from "./quiz-session";
import { isQuizConfigReady, type QuizConfig, type QuizSessionPayload } from "./types";

const initialConfig: QuizConfig = {
  path: "career",
  count: 10,
  experience: "training",
  timed: false,
  examScope: "latest",
};

export function QuizExperience() {
  const [config, setConfig] = useState<QuizConfig>(initialConfig);
  const [session, setSession] = useState<QuizSessionPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestSession(nextConfig: QuizConfig) {
    if (!isQuizConfigReady(nextConfig)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/session", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: nextConfig.path,
          careerSlug: nextConfig.careerSlug,
          specializationSlug: nextConfig.specializationSlug,
          bankSlug: nextConfig.bankSlug,
          subjectSlug: nextConfig.subjectSlug,
          topicSlug: nextConfig.topicSlug,
          mode: nextConfig.mode,
          count: nextConfig.count,
          experience: nextConfig.experience,
          timed: nextConfig.timed,
          examScope: nextConfig.examScope,
        }),
      });
      if (!response.ok) throw new Error("session_failed");
      const payload = (await response.json()) as QuizSessionPayload;
      setSession(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Não foi possível montar o quiz. Revise os filtros ou tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  function changeConfig(nextConfig: QuizConfig) {
    setConfig(nextConfig);
    setError(null);
  }

  function backToBuilder() {
    setSession(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchMode(mode: "dry_law" | "original_style") {
    const nextConfig = { ...config, mode };
    setConfig(nextConfig);
    setSession(null);
    void requestSession(nextConfig);
  }

  if (session) {
    return (
      <QuizSession
        config={config}
        key={session.sessionId}
        onBackToBuilder={backToBuilder}
        onRestart={() => void requestSession(config)}
        onSwitchMode={switchMode}
        payload={session}
      />
    );
  }

  return <QuizBuilder config={config} error={error} loading={loading} onChange={changeConfig} onStart={() => void requestSession(config)} />;
}
