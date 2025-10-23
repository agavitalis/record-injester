const formatString = (str: string) => {
  return str?.trim().replaceAll('###COMMA###', ',');
};

export { formatString };
