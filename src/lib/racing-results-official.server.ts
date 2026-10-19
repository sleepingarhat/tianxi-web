import type { OfficialResultMeeting } from './racing-results-schedule';

// Same official whitelist query as the existing going reader; no guessed timestamps.
const QUERY = `
query wt_WeatherMeeting( $localSim: LocalSim, $status: [MeetingStatus!])  {
  commonMeetings(localSim: $localSim, status: $status) {
    date
    venueCode
    meetingTrack_en
    meetingTrack_ch
    status
    totalNumberOfRace
    currentNumberOfRace
     meetingType
     penetrometerReadings {
      reading
      readingTime
      sequenceNumber
    }
    hammerReadings {
      sequenceNumber
      readingTime
      reading
    }
    course {
      code
      chinese
      english
      mandarin
    }
    races {
      go_en
      go_ch
      status
      no
      raceTrack {
        code
      }
    }
  }
}
`;

export async function readOfficialResultMeetings() {
  const response = await fetch('https://info.cld.hkjc.com/graphql/base/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://racing.hkjc.com', referer: 'https://racing.hkjc.com/' },
    body: JSON.stringify({ query: QUERY, variables: { localSim: 'LOCAL', status: ['DECLARED', 'DEFINED', 'STARTED', 'CLOSED', 'ABANDON_PARTIAL', 'ABANDON'] } }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`official-status-${response.status}`);
  const raw = await response.text();
  const json = JSON.parse(raw) as { errors?: unknown[]; data?: { commonMeetings?: OfficialResultMeeting[] } };
  if (json.errors?.length || !Array.isArray(json.data?.commonMeetings)) throw new Error('official-status-incomplete');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const sha256 = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  return { meetings: json.data.commonMeetings, sha256 };
}