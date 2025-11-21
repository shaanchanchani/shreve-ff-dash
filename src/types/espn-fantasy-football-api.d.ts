declare module 'espn-fantasy-football-api/node' {
  export class Client {
    constructor(options?: { leagueId?: number; espnS2?: string; SWID?: string });
    getTeamsAtWeek(params: { seasonId: number; scoringPeriodId: number }): Promise<unknown>;
    getBoxscoreForWeek(params: { seasonId: number; matchupPeriodId: number; scoringPeriodId: number }): Promise<unknown>;
    getDraftInfo(params: { seasonId: number; scoringPeriodId?: number }): Promise<unknown>;
  }
}
