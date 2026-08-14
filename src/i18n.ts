const messages = {
  en: {
    title: 'WOAH', subtitle: 'Choose. Look. Dodge.', start: 'Enable camera', privacy: 'Your camera is shared only with your opponent over an encrypted peer-to-peer connection. Face-direction detection stays on this device. Nothing is recorded.',
    cameraDenied: 'Camera access is needed to play. Allow it in your device settings, then try again.', cameraError: 'The camera is unavailable. Close other camera apps or switch cameras, then try again.', visionError: 'Face-direction detection could not start. Reopen the game and try again on a stable connection.', retry: 'Try again', models: 'Preparing face detection…', slow: 'This device is processing slowly. Keep the phone still and close other apps.',
    neutral: 'Face forward',
    faceSearching: 'Center your whole face in the frame', faceHold: 'Face detected — hold still', faceRecognized: 'Neutral position ready', calibrationRestart: 'Your face was not stable enough — face forward and try again', calibrated: 'Ready!', directionControl: 'Direction buttons', directionHint: 'Choose one arrow before WOAH', directionLocked: 'Guess locked', directionTiming: 'Time is up — wait for the next round', arrowUp: 'Choose up', arrowDown: 'Choose down', arrowLeft: 'Choose left', arrowRight: 'Choose right',
    share: 'Use the Share button above to invite one friend.', waiting: 'Waiting for your opponent…', opponentReady: 'Opponent is ready', connecting: 'Connecting cameras…', syncing: 'Synchronizing the beat…', reconnecting: 'Reconnecting — the round is paused', networkUnsupported: 'A direct camera connection could not be created on this network. Switch Wi-Fi or mobile data, then reopen the game.',
    pointer: 'GUESS', looker: 'DODGE', guessLabel: 'GUESS', faceLabel: 'FACE', yourGuessTurn: 'YOUR TURN TO GUESS', yourDodgeTurn: 'YOUR TURN TO DODGE', preparingTurn: 'CHOOSING THE FIRST TURN', pointerHint: 'Choose one arrow before WOAH. Your first choice is final.', lookerHint: 'After WOAH, turn your head within 3 seconds. The first recognized direction counts.', judging: 'Recognizing the first face direction…',
    hit: 'CORRECT!', dodge: 'MISSED!', penalty: 'POINT LOST', void: 'REPLAY', hitDetail: 'Correct guess: +1 point and you keep the turn.', dodgeDetail: 'The directions differed, so the turn switches.', penaltyDetail: 'A player did not move before time expired: −1 point and the turn switches.', voidDetail: 'Network timing or face confidence was not fair enough, so no score changed.',
    gameover: 'Match complete', you: 'You', opponent: 'Opponent', firstTo: 'First to 3', cameraEnded: 'The camera stopped. Start again to continue.',
  },
  mn: {
    title: 'WOAH', subtitle: 'Тааруул. Хар. Булт.', start: 'Камераа асаах', privacy: 'Камерын дүрс зөвхөн өрсөлдөгчтэй шифрлэгдсэн P2P холболтоор хуваалцана. Нүүрний чиглэл таних ажиллагаа энэ төхөөрөмж дээр хийгдэж, юу ч бичигдэхгүй.',
    cameraDenied: 'Тоглохын тулд камерын эрх хэрэгтэй. Төхөөрөмжийн тохиргооноос зөвшөөрөөд дахин оролдоно уу.', cameraError: 'Камер ашиглах боломжгүй байна. Камер ашиглаж буй бусад аппыг хаах эсвэл камераа солиод дахин оролдоно уу.', visionError: 'Нүүрний чиглэл танигч ассангүй. Тоглоомыг дахин нээгээд тогтвортой сүлжээн дээр оролдоно уу.', retry: 'Дахин оролдох', models: 'Нүүрний чиглэл танигчийг бэлдэж байна…', slow: 'Төхөөрөмж удаан боловсруулж байна. Утсаа тогтвортой барьж, бусад аппыг хаана уу.',
    neutral: 'Эгц урагшаа хар',
    faceSearching: 'Нүүрээ хүрээний голд бүтнээр нь харуулна уу', faceHold: 'Нүүр танигдлаа — хөдөлгөөнгүй барина уу', faceRecognized: 'Урагш харсан байрлал бэлэн', calibrationRestart: 'Нүүр тогтвортой танигдсангүй — урагшаа харж дахин оролдоно уу', calibrated: 'Бэлэн!', directionControl: 'Чиглэл сонгох дөрвөн сум', directionHint: 'WOAH болохоос өмнө нэг сум сонго', directionLocked: 'Таалт түгжигдлээ', directionTiming: 'Хугацаа дууслаа — дараагийн үеийг хүлээнэ үү', arrowUp: 'Дээш сонгох', arrowDown: 'Доош сонгох', arrowLeft: 'Зүүн сонгох', arrowRight: 'Баруун сонгох',
    share: 'Дээрх Share товчоор нэг найзаа урина уу.', waiting: 'Өрсөлдөгчөө хүлээж байна…', opponentReady: 'Өрсөлдөгч бэлэн', connecting: 'Камеруудыг холбож байна…', syncing: 'Цохилтын цагийг тааруулж байна…', reconnecting: 'Дахин холбогдож байна — үеийг түр зогсоолоо', networkUnsupported: 'Энэ сүлжээнд камерын шууд холболт үүссэнгүй. Wi-Fi эсвэл мобайл датагаа солиод тоглоомоо дахин нээнэ үү.',
    pointer: 'ТААХ', looker: 'БУЛТАХ', guessLabel: 'ТААЛТ', faceLabel: 'НҮҮР', yourGuessTurn: 'ТАНЫ ТААХ ЭЭЛЖ', yourDodgeTurn: 'ТАНЫ БУЛТАХ ЭЭЛЖ', preparingTurn: 'ЭХНИЙ ЭЭЛЖИЙГ СОНГОЖ БАЙНА', pointerHint: 'WOAH болохоос өмнө нэг сум сонго. Эхний сонголт эцсийнх байна.', lookerHint: 'WOAH-аас хойш 3 секундын дотор толгойгоо эргүүл. Эхэлж танигдсан чиглэлийг авна.', judging: 'Нүүрний эхний чиглэлийг таньж байна…',
    hit: 'ЗӨВ ТААЛАА!', dodge: 'ТААЖ ЧАДСАНГҮЙ!', penalty: 'ОНОО ХАСАГДЛАА', void: 'ДАХИН', hitDetail: 'Зөв таасан тул +1 оноо авч, ээлжээ хадгаллаа.', dodgeDetail: 'Чиглэл зөрсөн тул оноо нэмэгдэхгүй, ээлж солигдоно.', penaltyDetail: 'Хугацаанд хөдөлгөөн хийгээгүй тоглогчоос 1 оноо хасаж, ээлжийг солино.', voidDetail: 'Сүлжээний timing эсвэл нүүрний танилт шудар шийдэхэд хангалтгүй тул оноо өөрчлөгдөхгүй.',
    gameover: 'Тоглолт дууслаа', you: 'Та', opponent: 'Өрсөлдөгч', firstTo: '3 оноонд түрүүлнэ', cameraEnded: 'Камер зогслоо. Үргэлжлүүлэхийн тулд дахин асаана уу.',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function languageFor(value?: string): keyof typeof messages {
  return value?.toLowerCase().startsWith('mn') ? 'mn' : 'en';
}

export function translator(language: keyof typeof messages): (key: MessageKey) => string {
  return (key) => messages[language][key] ?? messages.en[key];
}
