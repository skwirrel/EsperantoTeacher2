/**
 * Created by intelWorx on 27/10/2015.
 */
(function (exports) {

  var MP3Recorder = function (config) {

    var recorder = this, startTime = 0, context = new AudioContext();
    config = config || {};
    var realTimeWorker = new Worker('js/worker-realtime.js');

    // Initializes LAME so that we can record.
    this.initialize = function () {
      config.sampleRate = context.sampleRate;
      realTimeWorker.postMessage({cmd: 'init', config: config});
    };


    // This function finalizes LAME output and saves the MP3 data to a file.
    var microphone = false , processor;
    // Function that handles getting audio out of the browser's media API.
    function beginRecording() {
      // Set up Web Audio API to process data from the media stream
      var a = document.getElementsByTagName("audio")[0];
    
      if (!microphone) microphone = context.createMediaElementSource(a);
      // Settings a bufferSize of 0 instructs the browser to choose the best bufferSize
      processor = context.createScriptProcessor(0, 1, 1);
      // Add all buffers from LAME into an array.
      processor.onaudioprocess = function (event) {
        // Send microphone data to LAME for MP3 encoding while recording.
        var array = event.inputBuffer.getChannelData(0);
        //console.log('Buffer Received', array);
        realTimeWorker.postMessage({cmd: 'encode', buf: array})

		var inputBuffer = event.inputBuffer;
		var outputBuffer = event.outputBuffer;

		// Loop through the output channels (in this case there is only one)
		for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
			var inputData = inputBuffer.getChannelData(channel);
			var outputData = outputBuffer.getChannelData(channel);
			// Loop through the 4096 samples
			for (var sample = 0; sample < inputBuffer.length; sample++) {
			  // make output equal to the same as the input
			  outputData[sample] = inputData[sample];
			}
		}
  
      };
      // Begin retrieving microphone data.
      microphone.connect(processor);
     
      processor.connect(context.destination);
      // Return a function which will stop recording and return all MP3 data.
    }

    this.stop = function () {
      if (processor && microphone) {
        // Clean up the Web Audio API resources.
        microphone.disconnect();
        processor.disconnect();
        processor.onaudioprocess = null;
        // Return the buffers array. Note that there may be more buffers pending here.
      }
    };


    // Function for kicking off recording once the button is pressed.
    this.start = function (onSuccess, onError) {
      // Request access to the microphone.

		var stopRecording = beginRecording();
		recorder.startTime = Date.now();
		if (onSuccess && typeof onSuccess === 'function') {
		  onSuccess();
		}
    };


    var mp3ReceiveSuccess, currentErrorCallback;
    this.getMp3Blob = function (onSuccess, onError) {
      currentErrorCallback = onError;
      mp3ReceiveSuccess = onSuccess;
      realTimeWorker.postMessage({cmd: 'finish'});
    };

    realTimeWorker.onmessage = function (e) {
      switch (e.data.cmd) {
        case 'end':
          if (mp3ReceiveSuccess) {
            mp3ReceiveSuccess(new Blob(e.data.buf, {type: 'audio/mp3'}));
          }
          console.log('MP3 data size', e.data.buf.length);
          break;
        case 'error':
          if (currentErrorCallback) {
            currentErrorCallback(e.data.error);
          }
          break;
        default :
          console.log('I just received a message I know not how to handle.', e.data);
      }
    };
    this.initialize();
  };

  exports.MP3Recorder = MP3Recorder;
})(window);
