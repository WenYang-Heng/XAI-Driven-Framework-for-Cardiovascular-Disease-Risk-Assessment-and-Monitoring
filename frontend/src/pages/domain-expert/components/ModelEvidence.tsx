import { useEffect, useState } from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import type { GlobalShapExplanation, ModelKey, ModelPerformance } from '../types';
import { modelLabels } from '../constants';
import { ApiError, modelApi } from '../api';
import { Card } from '../../../components/ui/Card';
import { MetricCard, ModelPerformancePanel } from './Shared';
import { GlobalShapPanel } from './Xai';

export function ModelEvidence() {
  const [defaultModel, setDefaultModel] = useState<ModelKey | null>(null);
  const [performance, setPerformance] = useState<ModelPerformance | null>(null);
  const [globalShap, setGlobalShap] = useState<GlobalShapExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    async function load() {
      const model = await modelApi.list().then((body) => body.default_model).catch(() => "logistic_regression" as ModelKey);
      if (!current) {
        return;
      }
      setDefaultModel(model);
      await Promise.all([
        modelApi.metrics(model).then(setPerformance).catch((caught: ApiError) => setMetricsError(caught.message)),
        // A 404 just means global SHAP hasn't been generated yet; the panel explains how.
        modelApi.globalShap(model).then(setGlobalShap).catch(() => setGlobalShap(null)),
      ]);
      if (current) {
        setIsLoading(false);
      }
    }
    load();
    return () => {
      current = false;
    };
  }, []);

  const modelLabel = defaultModel ? modelLabels[defaultModel] : "Loading…";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard icon={ShieldCheck} label="Model in use" value={modelLabel} detail="Chosen by the system administrator" tone="purple" />
        <MetricCard icon={Database} label="Trained on" value="Framingham Heart Study" detail="4,240 adults aged 32–70, 10-year CHD outcome" tone="slate" />
      </div>
      <ModelPerformancePanel modelLabel={modelLabel} performance={performance} isLoading={isLoading} error={metricsError} />
      <GlobalShapPanel globalShap={globalShap} isLoading={isLoading} />
      <Card className="p-6 text-sm leading-6 text-slate-600">
        <h3 className="text-base font-bold text-slate-950">Known limitations</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Trained on a mid-20th-century US cohort that is predominantly white. Calibration may differ in other populations.</li>
          <li>Covers ages 32–70. Estimates outside that range are extrapolations and are flagged as such.</li>
          <li>Predicts coronary heart disease only, not stroke or overall cardiovascular disease.</li>
          <li>Does not use HDL cholesterol, family history or ethnicity, which established risk scores include.</li>
        </ul>
      </Card>
    </div>
  );
}
