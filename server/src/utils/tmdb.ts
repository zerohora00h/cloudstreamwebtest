import axios from 'axios';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_API_TOKEN = process.env.TMDB_API_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_TOKEN) {
    console.warn('[TMDB] Aviso: TMDB_API_TOKEN não encontrado no ambiente!');
} else {
    console.log('[TMDB] Token carregado com sucesso (Início:', TMDB_API_TOKEN.substring(0, 10), '...)');
}

export class TMDB {
    private static axiosInstance = axios.create({
        baseURL: BASE_URL,
        headers: {
            Authorization: `Bearer ${TMDB_API_TOKEN}`,
            'Content-Type': 'application/json;charset=utf-8'
        }
    });

    /**
     * Pesquisa filmes por título
     */
    static async searchMovies(query: string, page = 1) {
        try {
            const response = await this.axiosInstance.get('/search/movie', {
                params: {
                    query,
                    page,
                    language: 'pt-BR'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('[TMDB] Erro na busca de filmes:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Obtém detalhes de um filme
     */
    static async getMovieDetails(movieId: number) {
        try {
            const response = await this.axiosInstance.get(`/movie/${movieId}`, {
                params: {
                    language: 'pt-BR',
                    append_to_response: 'videos,credits,images,external_ids'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('[TMDB] Erro ao obter detalhes do filme:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Pesquisa séries por título
     */
    static async searchTVShows(query: string, page = 1) {
        try {
            const response = await this.axiosInstance.get('/search/tv', {
                params: {
                    query,
                    page,
                    language: 'pt-BR'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('[TMDB] Erro na busca de séries:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Obtém detalhes de uma série
     */
    static async getTVShowDetails(tvId: number) {
        try {
            const response = await this.axiosInstance.get(`/tv/${tvId}`, {
                params: {
                    language: 'pt-BR',
                    append_to_response: 'videos,credits,images,external_ids'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('[TMDB] Erro ao obter detalhes da série:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Busca por ID externo (ex: IMDB ID)
     */
    static async findByExternalId(externalId: string) {
        try {
            const response = await this.axiosInstance.get(`/find/${externalId}`, {
                params: {
                    external_source: 'imdb_id',
                    language: 'pt-BR'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('[TMDB] Erro ao buscar por ID externo:', error.response?.data || error.message);
            throw error;
        }
    }
}
