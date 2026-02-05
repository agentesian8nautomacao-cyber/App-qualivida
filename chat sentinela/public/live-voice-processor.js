// AudioWorkletProcessor para captura de áudio de microfone em streaming
// na interface de chat Sentinela.

class LiveVoiceProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channel = input[0];

      // Envia frame para a thread principal
      this.port.postMessage(channel.slice(0));

      const output = outputs[0];
      if (output && output[0]) {
        output[0].set(channel);
      }
    }

    return true;
  }
}

registerProcessor('live-voice-processor', LiveVoiceProcessor);

