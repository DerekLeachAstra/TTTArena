import { useSearchParams } from 'react-router-dom';
import LiveGame from './LiveGame';

export default function LiveGameWrapper() {
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('leagueId');
  const leagueName = searchParams.get('leagueName');
  const rivalryId = searchParams.get('rivalryId');
  const rivalName = searchParams.get('rivalName');
  const initialMode = searchParams.get('mode');
  const tournamentMatchId = searchParams.get('tournamentMatchId');
  const tournamentName = searchParams.get('tournamentName');
  const gameId = searchParams.get('gameId');
  return <LiveGame leagueId={leagueId} leagueName={leagueName} rivalryId={rivalryId} rivalName={rivalName} initialMode={initialMode} tournamentMatchId={tournamentMatchId} tournamentName={tournamentName} gameId={gameId} />;
}
