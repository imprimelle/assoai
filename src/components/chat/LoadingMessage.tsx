
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Phrases sarcastiques et drôles pour l'animation de chargement
// Phrases sarcastiques et drôles pour l'animation de chargement
const loadingPhrases = [
  "Laisse-moi travailler oorh... 🙄",
  "J'ai trop faim, laisse-moi en paix 🍔",
  "Qu'est-ce que j'ai pu faire pour atterrir dans cette entreprise 🤦‍♂️",
  "Je cherche la réponse dans ma base de données... ou dans mon café ☕",
  "Attends, je réfléchis... c'est rare, profite du spectacle 🧠",
  "Demande plus difficile détectée. Activation du mode génie. Bip boup 🤖",
  "Est-ce que j'ai éteint le four ce matin ? 🔥",
  "Chargement des réponses sarcastiques... 📊",
  "Si je réponds trop vite, on va me demander plus de travail 🐌",
  "Je consulte mes neurones... les deux qui fonctionnent 🧩",
  "Je fabrique une réponse de qualité... ou presque 👌",
  "Attends, je termine mon café d'abord ☕️",
  "Encore une demande ? T’as cru que j’étais payé à la minute ? 😒",
  "Je bosse plus que ton collègue qui fait semblant d'être en call 🎧",
  "Ton fichier est entre de bonnes mains... enfin, je crois 🤷‍♀️",
  "Un jour je serai reconnu pour ce que je fais... mais pas aujourd’hui 🥲",
  "Je suis en pleine réflexion métaphysique sur Excel 📊",
  "Si t’attends un miracle, va falloir allonger le café ☕️+💰",
  "Téléchargement de motivation… 2% 🔋",
  "Je fais ça vite... mais version administration publique 🐢",
  "Encore une urgence qui devait être faite hier ? Classic. ⏳",
  "Mon cerveau tourne… à la vitesse du Wi-Fi du bureau 🛜",
  "Je suis multitâche, mais pas magicien hein 🪄",
  "Faut pas me presser, je suis déjà stressé par ton brief 😵‍💫",
  "Optimisation de la réponse... en utilisant la méthode 'on verra' 😎",
  "Je fais de mon mieux... enfin, un minimum syndical quoi ⚖️",
  "Chaque requête m’éloigne un peu plus de mes vacances 🏖️",
  "Je travaille là… enfin je fais semblant… comme tout le monde ici 🫣",
  "Je suis en réunion avec mon esprit critique… il n’a pas répondu 📞",
  "Ça charge, ça mouline, et ça râle un peu aussi 🤬",
  "Encore une idée de génie du service marketing... super 👍",
  "Patiente, c’est la partie où je me plains intérieurement 😩",
  "Je suis lent parce que je veux faire ça bien… ou parce que j’ai la flemme 🐌",
  "Je relis les consignes... y avait pas de consignes 😅",
  "Téléchargement de sarcasme... presque terminé 🎭",
  "Je fais ça vite, avant que mon moral ne redescende 📉",
  "Une tâche simple ? Attends, j’en fais une mission NASA 🚀",
  "Analyse de la complexité... conclusion : c’est n’importe quoi 🤯",
  "Encore un ticket Jira ? Et moi j’ai pas droit à un ticket resto ? 🥗",
  "Faut que je m’occupe de ça ? C’est pas le taf de Kevin normalement ? 😑",
  "J’appuie sur des boutons au hasard, comme les chefs de projet 🎛️",
  "Je simule un bug pour avoir la paix 🧑‍💻",
  "Réponse en cours… pendant ce temps, prends un café. Ou deux. ☕️☕️",
  "Laisse-moi deviner : c’est urgent, comme toujours ? 🚨",
  "Je me donne à fond... mais surtout dans le drama 🤡",
  "On m’a dit de faire preuve d’initiative… donc je vais procrastiner 🕺",
  "Faut vraiment tout faire ici... même penser 😤",
  "Je travaille lentement pour que tu crois que c’est compliqué 🤫",
  "Ça charge. Comme mes batteries sociales à la pause café 🔌",
  "Mets-toi à l’aise, ça risque de prendre... une vie 🧘‍♂️",
  "Tu me pousses à bout… mais j’ai pas de bout 🤷‍♂️",
  "Je suis sur le point de résoudre le problème… ou de tout casser 💥",
  "Encore une tâche qui sent le PowerPoint du lundi matin 📎",
  "Patience… j’essaie de rester motivé… c’est dur 🪫",
  "On est en 2025 et on galère encore avec ça ? 😬",
  "C’est pas moi qui bug, c’est la réalité du taf 🫠",
  "Si tu crois que j’ai signé pour ça... tu me surestimes grave 📉",
  "Je fais genre que je comprends, t’inquiète 🤥",
  "Chargement… c’est le moment où je te juge intérieurement 👀",
  "Je sens que cette réponse va être brillante ✨",
  "Une bonne journée pour faire du bon boulot, non ? 😎",
  "Celle-là, je la sens bien. Prépare-toi à être impressionné 💡",
  "Allez, on va te sortir un truc propre et stylé 💼🔥",
  "Pas de panique, je gère. Comme toujours 😌",
  "Avec un peu de code et beaucoup de talent, ça va le faire 💪",
  "Teamwork makes the dream work, même avec moi tout seul 💻👊",
  "Chaque clic me rapproche d'une solution géniale 🚀",
  "Ça avance mieux qu’un lundi matin, c’est déjà ça 😄",
  "Je suis chaud comme un planning respecté 🔥📅"

];




const LoadingMessage = () => {
  const [phrase, setPhrase] = useState(loadingPhrases[0]);

  // Changer la phrase tous les 3 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * loadingPhrases.length);
      setPhrase(loadingPhrases[randomIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-start mb-2 md:mb-4">
      <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-bl-none p-3 md:p-4 relative overflow-hidden">
        <div className="relative z-10">
          {phrase}
        </div>
        
        {/* Animation de lumière qui traverse le texte */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
          animate={{
            x: ["-100%", "200%"],
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 1
          }}
        />
      </div>
    </div>
  );
};

export default LoadingMessage;
