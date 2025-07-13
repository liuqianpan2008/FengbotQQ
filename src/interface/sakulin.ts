export interface RootObject {
  success: boolean;
  detail: Detail;
  pdf: string[];
}

export interface Detail {
  save_path: string;
  exists: boolean;
  skip: boolean;
  album_id: string;
  scramble_id: string;
  name: string;
  page_count: number;
  pub_date: string;
  update_date: string;
  likes: string;
  views: string;
  comment_count: number;
  works: string[];
  actors: any[];
  tags: string[];
  authors: string[];
  episode_list: (number | string)[][];
  related_list: Relatedlist[];
}

export interface Relatedlist {
  id: string;
  author: string;
  name: string;
  image: string;
}