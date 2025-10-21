// backend/services/kitsuService.js
const axios = require('axios');

class KitsuService {
  constructor() {
    this.baseURL = 'https://kitsu.io/api/edge';
  }

  async searchAnime(title) {
    try {
      const response = await axios.get(`${this.baseURL}/anime`, {
        params: {
          'filter[text]': title,
          'page[limit]': 5
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Kitsu search error:', error);
      return [];
    }
  }

  async getEpisodes(animeId) {
    try {
      const response = await axios.get(`${this.baseURL}/episodes`, {
        params: {
          'filter[mediaId]': animeId,
          'page[limit]': 50,
          'sort': 'number'
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Kitsu episodes error:', error);
      return [];
    }
  }
}

module.exports = new KitsuService();
