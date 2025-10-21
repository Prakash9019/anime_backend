// backend/services/malService.js
const axios = require('axios');

class MALService {
  constructor() {
    this.baseURL = 'https://api.myanimelist.net/v2';
    this.clientId = "740ae26e92aa12b0264da163d2277d73";
  }
  // Get anime ranking list (top/popular etc.)
  async getAnimeRanking({ ranking_type = 'all', limit = 50, offset = 0 } = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/anime/ranking`, {
        params: {
          ranking_type,
          limit,
          offset,
          fields: [
            'id,title,main_picture,alternative_titles,start_date,end_date,synopsis',
            'mean,rank,popularity,num_episodes,start_season,broadcast',
            'source,average_episode_duration,rating,genres,studios'
          ].join(',')
        },
        headers: {
          'X-MAL-CLIENT-ID': this.clientId
        }
      });

      return response.data;
    } catch (error) {
      console.error('MAL API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch anime ranking from MAL');
    }
  }

  // Get single anime details by MAL ID
  async getAnimeDetails(id) {
    try {
      const response = await axios.get(`${this.baseURL}/anime/${id}`, {
        params: {
          fields: [
            'id,title,main_picture,alternative_titles,start_date,end_date,synopsis',
            'mean,rank,popularity,num_episodes,start_season,broadcast',
            'source,average_episode_duration,rating,genres,studios',
            'background,related_anime,related_manga,recommendations'
          ].join(',')
        },
        headers: {
          'X-MAL-CLIENT-ID': this.clientId
        }
      });

      return response.data;
    } catch (error) {
      console.error('MAL API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch anime details from MAL');
    }
  }

  // Search anime by query string
  async searchAnime(query, limit = 20) {
    try {
      const response = await axios.get(`${this.baseURL}/anime`, {
        params: {
          q: query,
          limit,
          fields: [
            'id,title,main_picture,alternative_titles,start_date,end_date,synopsis',
            'mean,rank,popularity,num_episodes,genres,studios'
          ].join(',')
        },
        headers: {
          'X-MAL-CLIENT-ID': this.clientId
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('MAL Search Error:', error.response?.data || error.message);
      throw new Error('Failed to search anime');
    }
  }

  async getAnimeList(limit = 100, offset = 0) {
    try {
      const response = await axios.get(`${this.baseURL}/anime/ranking`, {
        params: {
          ranking_type: 'all',
          limit,
          offset,
          fields: 'id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,num_episodes,start_season,broadcast,source,average_episode_duration,rating,pictures,background,related_anime,related_manga,recommendations,studios,statistics'
        },
        headers: {
          'X-MAL-CLIENT-ID': this.clientId
        }
      });

      return response.data.data.map(item => ({
        malId: item.node.id,
        title: item.node.title,
        titleEnglish: item.node.alternative_titles?.en,
        titleJapanese: item.node.alternative_titles?.ja,
        synopsis: item.node.synopsis,
        poster: item.node.main_picture?.large || item.node.main_picture?.medium,
        type: item.node.media_type,
        status: item.node.status,
        startDate: item.node.start_date,
        endDate: item.node.end_date,
        genres: item.node.genres?.map(g => g.name) || [],
        studios: item.node.studios?.map(s => s.name) || [],
        source: item.node.source,
        rating: item.node.rating,
        popularity: item.node.popularity,
        rank: item.ranking?.rank,
        numEpisodes: item.node.num_episodes,
      }));
    } catch (error) {
      console.error('MAL API Error:', error);
      throw new Error('Failed to fetch anime data from MAL');
    }
  }

  async getAnimeById(id) {
    try {
      const response = await axios.get(`${this.baseURL}/anime/${id}`, {
        params: {
          fields: 'id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,num_episodes,start_season,broadcast,source,average_episode_duration,rating,pictures,background,related_anime,related_manga,recommendations,studios,statistics'
        },
        headers: {
          'X-MAL-CLIENT-ID': this.clientId
        }
      });

      const anime = response.data;
      return {
        malId: anime.id,
        title: anime.title,
        titleEnglish: anime.alternative_titles?.en,
        titleJapanese: anime.alternative_titles?.ja,
        synopsis: anime.synopsis,
        poster: anime.main_picture?.large || anime.main_picture?.medium,
        type: anime.media_type,
        status: anime.status,
        startDate: anime.start_date,
        endDate: anime.end_date,
        genres: anime.genres?.map(g => g.name) || [],
        studios: anime.studios?.map(s => s.name) || [],
        source: anime.source,
        rating: anime.rating,
        popularity: anime.popularity,
        rank: anime.rank,
        numEpisodes: anime.num_episodes,
      };
    } catch (error) {
      console.error('MAL API Error:', error);
      throw new Error('Failed to fetch anime details from MAL');
    }
  }

  async searchAnime(query, limit = 20) {
    try {
      const response = await axios.get(`${this.baseURL}/anime`, {
        params: {
          q: query,
          limit,
          fields: 'id,title,main_picture,alternative_titles,start_date,synopsis,mean,popularity'
        },
        headers: {
          'X-MAL-CLIENT-ID': this.clientId
        }
      });

      return response.data.data.map(item => ({
        malId: item.node.id,
        title: item.node.title,
        titleEnglish: item.node.alternative_titles?.en,
        synopsis: item.node.synopsis,
        poster: item.node.main_picture?.large || item.node.main_picture?.medium,
        startDate: item.node.start_date,
        popularity: item.node.popularity,
      }));
    } catch (error) {
      console.error('MAL Search Error:', error);
      throw new Error('Failed to search anime');
    }
  }
}

module.exports = new MALService();
