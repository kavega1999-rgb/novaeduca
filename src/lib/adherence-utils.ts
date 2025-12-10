// Adherence scoring utilities

export const getScoreCategory = (score: number): string => {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Bueno';
  if (score >= 70) return 'Aceptable';
  return 'Inaceptable';
};

export const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'Excelente': return 'text-green-600 bg-green-100';
    case 'Bueno': return 'text-blue-600 bg-blue-100';
    case 'Aceptable': return 'text-amber-600 bg-amber-100';
    default: return 'text-red-600 bg-red-100';
  }
};

export const generateConclusion = (
  pretestScore: number,
  postestScore: number,
  trainingTitle: string
): string => {
  const improvement = postestScore - pretestScore;
  const pretestCategory = getScoreCategory(pretestScore);
  const postestCategory = getScoreCategory(postestScore);

  if (improvement > 20) {
    return `El participante demostró una mejora sobresaliente de ${improvement.toFixed(1)} puntos porcentuales en la capacitación "${trainingTitle}". Pasó de un nivel ${pretestCategory} (${pretestScore.toFixed(1)}%) a ${postestCategory} (${postestScore.toFixed(1)}%), evidenciando una excelente asimilación del contenido y compromiso con el aprendizaje.`;
  } else if (improvement > 10) {
    return `El participante mostró una mejora significativa de ${improvement.toFixed(1)} puntos porcentuales. El nivel inicial ${pretestCategory} (${pretestScore.toFixed(1)}%) evolucionó a ${postestCategory} (${postestScore.toFixed(1)}%) tras la capacitación "${trainingTitle}", lo que indica una buena comprensión del material.`;
  } else if (improvement > 0) {
    return `Se observa una mejora moderada de ${improvement.toFixed(1)} puntos porcentuales en la capacitación "${trainingTitle}". El participante pasó de ${pretestScore.toFixed(1)}% (${pretestCategory}) a ${postestScore.toFixed(1)}% (${postestCategory}). Se recomienda reforzar algunos conceptos.`;
  } else if (improvement === 0) {
    return `El participante mantuvo el mismo nivel de conocimiento antes y después de la capacitación "${trainingTitle}" (${postestScore.toFixed(1)}% - ${postestCategory}). Se sugiere revisar la metodología de enseñanza o realizar un seguimiento personalizado.`;
  } else {
    return `Se detectó una disminución de ${Math.abs(improvement).toFixed(1)} puntos porcentuales entre el pretest (${pretestScore.toFixed(1)}%) y el postest (${postestScore.toFixed(1)}%) en "${trainingTitle}". Esto puede indicar fatiga, falta de concentración o necesidad de refuerzo en los conceptos clave.`;
  }
};

export const generateStrategies = (
  pretestScore: number,
  postestScore: number,
  postestCategory: string
): string => {
  const improvement = postestScore - pretestScore;
  const strategies: string[] = [];

  // Based on final score category
  if (postestCategory === 'Excelente') {
    strategies.push("• Mantener el excelente nivel alcanzado mediante capacitaciones de actualización periódicas.");
    strategies.push("• Considerar al participante como mentor para apoyar a compañeros con dificultades.");
    strategies.push("• Proporcionar material avanzado para continuar su desarrollo profesional.");
  } else if (postestCategory === 'Bueno') {
    strategies.push("• Reforzar los temas donde se presentaron errores mediante ejercicios prácticos.");
    strategies.push("• Programar una sesión de repaso corta en las próximas 2 semanas.");
    strategies.push("• Proporcionar material complementario de lectura.");
  } else if (postestCategory === 'Aceptable') {
    strategies.push("• Realizar una tutoría personalizada enfocada en los conceptos principales.");
    strategies.push("• Implementar evaluaciones de seguimiento semanales.");
    strategies.push("• Considerar métodos de aprendizaje alternativos (videos, talleres prácticos).");
    strategies.push("• Verificar comprensión mediante casos prácticos y simulaciones.");
  } else {
    strategies.push("• Programar una recapacitación completa con metodología diferente.");
    strategies.push("• Asignar un tutor o compañero de apoyo para acompañamiento.");
    strategies.push("• Identificar posibles barreras de aprendizaje (tiempo, recursos, motivación).");
    strategies.push("• Dividir el contenido en módulos más pequeños y manejables.");
    strategies.push("• Realizar seguimiento semanal del progreso.");
  }

  // Based on improvement
  if (improvement < 0) {
    strategies.push("• Investigar factores externos que pudieron afectar el desempeño (estrés, carga laboral).");
    strategies.push("• Revisar si el formato de la evaluación es adecuado para el participante.");
  }

  return strategies.join("\n");
};

export const calculateAdherencePercentage = (
  completedCount: number,
  totalCount: number
): number => {
  if (totalCount === 0) return 0;
  return (completedCount / totalCount) * 100;
};
