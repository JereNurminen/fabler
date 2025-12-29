import styled from "styled-components";
import { theme } from "../style";

export const Card = styled.div`
  border-radius: 5px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: white;
  border: solid 1px #e6e6e6;
`;

export const CardTitle = styled.h2`
  font-size: ${theme.fonts.size.l};
  font-weight: 700;
  color: #333;
`;

export const CardDescription = styled.p`
  font-size: ${theme.fonts.size.m};
  color: #666;
`;

const CardButtonContainer = styled.div`
  display: "flex";
  flex-direction: "row";
  align-items: "space-between";
`;
