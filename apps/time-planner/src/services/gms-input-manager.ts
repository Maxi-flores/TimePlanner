import bridgeConfig from '../../lab-json-bridge.config.json';

type StepEmission = Readonly<{
  timestamp: number;
  tick_index: number;
  phase_label: string;
  step_frequency_hz: number;
}>;

const DEFAULT_TARGET_HZ = 60;
const configuredCapacity = Number(
  bridgeConfig?.ingress_contracts?.StepEmissions?.ring_buffer?.max_samples
);
const DEFAULT_CAPACITY = Number.isFinite(configuredCapacity)
  ? Math.max(1, Math.floor(configuredCapacity))
  : 500;

export class GmsInputManager {
  private readonly capacity: number;
  private readonly ringBuffer: Array<StepEmission | null>;
  private writeIndex = 0;
  private size = 0;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    const normalizedCapacity = Math.max(1, Math.floor(capacity));
    this.capacity = normalizedCapacity;
    this.ringBuffer = new Array<StepEmission | null>(normalizedCapacity).fill(
      null
    );
  }

  ingestStepEmission(sample: StepEmission): void {
    const immutableSample = Object.freeze({ ...sample });
    this.ringBuffer[this.writeIndex] = immutableSample;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  getLinearSamples(): ReadonlyArray<StepEmission> {
    const output: StepEmission[] = new Array(this.size);
    if (this.size === 0) {
      return output;
    }

    const startIndex =
      (this.writeIndex - this.size + this.capacity) % this.capacity;
    for (let i = 0; i < this.size; i += 1) {
      const index = (startIndex + i) % this.capacity;
      const sample = this.ringBuffer[index];
      if (sample) {
        output[i] = sample;
      }
    }

    return output;
  }

  calculateCadenceStability(targetHz: number = DEFAULT_TARGET_HZ): number {
    const samples = this.getLinearSamples();
    if (samples.length === 0 || targetHz <= 0) {
      return 0;
    }

    let totalFrequency = 0;
    for (const sample of samples) {
      totalFrequency += sample.step_frequency_hz;
    }

    const averageFrequency = totalFrequency / samples.length;
    const varianceRatio = Math.abs(averageFrequency - targetHz) / targetHz;
    const rating = Math.max(0, Math.min(100, (1 - varianceRatio) * 100));

    return Number(rating.toFixed(2));
  }
}
