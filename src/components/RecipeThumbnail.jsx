import {useState} from 'react';
import {BookOpen} from './icons';
import {safeRecipeUrl} from '../lib/recipeImport';
export default function RecipeThumbnail({recipe={}}){
 const [failed,setFailed]=useState('');
 const photo=recipe.sourcePhotos?.[0];
 const src=safeRecipeUrl(recipe.thumbnail) || (/^data:image\/(jpeg|png|webp);base64,/.test(photo || '')?photo:'');
 return <div className="recipe-book-thumbnail">{src && failed!==src?<img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:<BookOpen size={36} aria-hidden="true"/>}</div>;
}
