/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { Button } from '../components/button/Button';

import './ConsolePage.scss';

export function ConsolePage() {

  localStorage.setItem('tmp::voice_api_key', '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');
  const sampleString = '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'
  // const apiKey = LOCAL_RELAY_SERVER_URL
  //   ? ''
  //   : localStorage.getItem('tmp::voice_api_key') ||
  //     prompt('OpenAI API Key') ||
  //     '';
  // if (apiKey !== '') {
  //   localStorage.setItem('tmp::voice_api_key', apiKey);
  // }

  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: sampleString,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  const [items, setItems] = useState<ItemType[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const toggleConversation = useCallback(async () => {
    if (isConnected) {
      await disconnectConversation();
    } else {
      await connectConversation();
    }
  }, [isConnected]);

  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    setIsConnected(true);
    setItems([]);

    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();

    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello! I'd like to order some food.`,
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setItems([]);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      setItems(items);
      // {"item": "Vanilla milk shake", "quantity": 1, "price": 3}
    });

    client.updateSession({
      turn_detection: { type: 'server_vad' },
    });

    return () => {
      client.reset();
    };
  }, []);

  return (
    <div data-component="ConsolePage">
      <div className="restaurant-menu">
        <h1>Welcome to AI Restaurant</h1>
        <p>Speak to our AI assistant to place your order!</p>
        <h2>Menu</h2>
        <ul>
          <li>Cheese burger - $4</li>
          <li>Chicken Nuggets - $3</li>
          <li>Vanilla milk shake - $3</li>
          <li>Fries - $3.5</li>
          <li>Diet Coke - $3</li>
          <li>Chocolate milk shake - $3</li>
          <li>Potato wedges - $4</li>
          <li>Classic Chicken burger - $5</li>
          <li>Coke - $2</li>
          <li>Chicken wings - $5</li>
          <li>Strawberry milk shake - $3</li>
        </ul>
      </div>
      <div className="chat-container">
        <div className="chat-messages">
          {items.map((item, index) => (
            <div key={index} className={`message ${item.role}`}>
              {item.formatted.text || item.formatted.transcript}
            </div>
          ))}
        </div>
        <div className="chat-controls">
          <Button
            label={isConnected ? 'End Order' : 'Start Order'}
            buttonStyle={isConnected ? 'regular' : 'action'}
            onClick={toggleConversation}
          />
        </div>
      </div>
    </div>
  );
}