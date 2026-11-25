class MiaMicrophone extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Int16Array(480);
    this.length = 0;
    this.position = 0;
  }
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    const step = sampleRate / 24000;
    while (this.position < samples.length) {
      const index = Math.floor(this.position);
      const fraction = this.position - index;
      const value = samples[index] + (samples[Math.min(index + 1, samples.length - 1)] - samples[index]) * fraction;
      this.frame[this.length++] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
      if (this.length === this.frame.length) {
        this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
        this.frame = new Int16Array(480);
        this.length = 0;
      }
      this.position += step;
    }
    this.position -= samples.length;
    return true;
  }
}
registerProcessor('mia-microphone', MiaMicrophone);
